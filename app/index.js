const express = require("express");
const bodyParser = require("body-parser");
const Blockchain = require("../blockchain/index");
const Wallet = require("../wallet");
const TransactionPool = require("../transaction/transaction-pool");
const BidManager = require("../bid/bid-manager");
const P2PServer = require("./p2p-server");
const LuckNode = require("../proof-of-luck/luck-node");
const LuckConsensus = require("../proof-of-luck/luck-consensus");

const ENABLE_SENSOR_SIM = process.env.ENABLE_SENSOR_SIM || false;
const CONSENSUS_TYPE = process.env.CONSENSUS_TYPE || "bid";

let roundStart;

const {
  ROUND_INTERVAL,
  PHASE_1_DURATION,
  PHASE_3_START,
  PROPOSAL_SCHEDULE_DELAY,
  CLEANUP_INDEX_FREQUENCY,
  CLEANUP_LIMIT,
} = require("../config");
const PORT = process.env.PORT || 3001;

const app = express();

const startServer = async () => {
  let consensusType = CONSENSUS_TYPE;

  console.log(`🗳 Selected consensus: ${consensusType}`);

  app.use(bodyParser.json());

  const wallet = await Wallet.loadOrCreate();
  const blockchain = await Blockchain.create(wallet);
  const tp = new TransactionPool();
  const bidManager = new BidManager(wallet.publicKey, blockchain);

  const luckConsensus = new LuckConsensus(blockchain, null);
  const p2pServer = new P2PServer(
    blockchain,
    tp,
    bidManager,
    wallet,
    luckConsensus
  );
  luckConsensus.p2pServer = p2pServer;

  const luckNode = new LuckNode(blockchain, wallet, p2pServer, tp);

  // const p2pServer = new P2PServer(blockchain, tp, bidManager);

  app.get("/blocks", (req, res) => {
    res.json(blockchain.chain);
  });

  app.get("/transaction", (req, res) => {
    res.json(tp.transactions);
  });

  app.get("/bids/:round", (req, res) => {
    const { round } = req.params;
    const bidList = bidManager.getAllBids(parseInt(round, 10));
    if (bidList.length > 0) {
      res.status(200).json(bidList);
    } else {
      res.status(404).json({ message: "No bids found for this round" });
    }
  });

  // app.post("/transact", (req, res) => {
  //   const { recipient, amount } = req.body;
  //   const transaction = wallet.createTransaction(recipient, amount, tp, bc);
  //   p2pServer.broadcastTransaction(transaction);

  //   res.redirect("/transaction");
  // });

  // Create a sensor reading transaction (IoT)
  app.post("/transact", (req, res) => {
    try {
      const { sensor_id, reading, metadata } = req.body;

      // Basic validation
      if (!sensor_id || typeof sensor_id !== "string") {
        return res
          .status(400)
          .json({ ok: false, error: "sensor_id is required (string)" });
      }
      if (!reading || typeof reading !== "object" || Array.isArray(reading)) {
        return res
          .status(400)
          .json({ ok: false, error: "reading must be a non-null object" });
      }
      if (
        metadata != null &&
        (typeof metadata !== "object" || Array.isArray(metadata))
      ) {
        return res
          .status(400)
          .json({ ok: false, error: "metadata must be an object if provided" });
      }

      const tx = wallet.createTransaction(sensor_id, reading, tp, metadata);
      p2pServer.transactionPool.updateOrAddTransaction(tx);
      p2pServer.broadcastTransaction(tx);

      return res.status(201).json({ ok: true, transaction: tx });
    } catch (err) {
      console.error("Failed to create transaction:", err);
      return res
        .status(500)
        .json({ ok: false, error: err.message || "internal error" });
    }
  });

  app.post("/delayedTransact", (req, res) => {
    try {
      const {transaction} = req.body;
      console.log(`📥 Transaction received with sensor-id-${JSON.stringify(transaction.sensor_id)} at p2p-server`);
      tp.updateOrAddTransaction(transaction); 
    } catch (err) {
      console.error("Failed to process transaction:", err);
      return res
        .status(500)
        .json({ ok: false, error: err.message || "internal error" });
    }
  });

  app.listen(PORT, () => {
    console.log(`\nServer is running on port ${PORT}`);
  });

  p2pServer.listen();

  p2pServer.syncChains();

  if (consensusType == "luck") {
    startPoLRoundScheduler();
  } else if (consensusType == "bid") {
    startRoundScheduler();
  } else {
    throw new Error(
      "Invalid consensus type. Use --consensus=luck or --consensus=bid"
    );
  }

  /**
   * Utility: get aligned time offset for round loop
   */
  function getNextAlignedDelay(intervalMs) {
    const now = Date.now();
    return intervalMs - (now % intervalMs);
  }

  /**
   * Phase 1: publish random number
   */
  function phase1() {
    bidManager.round += 1;
    const bidPacket = bidManager.generateBid(bidManager.round, wallet);
    p2pServer.broadcastBid(bidPacket);
    console.log(`This is Round: ${bidPacket.round}`);
  }

  /**
   * Phase 2: intermediate phase (2–9 min)
   */
  function phase2() {
    console.log(`[${Date.now()}] Phase 2: Waiting for leader...`);
    // Collect random numbers, do nothing
  }

  /**
   * Phase 3: block proposal
   */
  async function phase3() {
    p2pServer.broadcastBlock(bidManager.round, wallet, roundStart);
    let currentIndex = blockchain.getLastBlock().index;
    if (currentIndex % CLEANUP_INDEX_FREQUENCY === 0) {
      const cleanUpTime = blockchain.getLastBlock().timestamp - (CLEANUP_LIMIT * ROUND_INTERVAL);
      cleanupPendingTransactions(cleanUpTime);
    }
  }

  /**
   * Start a round-aligned loop
   */
  function startRoundScheduler() {
    console.log(`\n🕣 Time now in ms: ${Date.now()}`);
    const delay = getNextAlignedDelay(ROUND_INTERVAL);
    console.log(`⏱ First round starts in ${delay / 1000}s`);

    setTimeout(async function runSequentialRounds() {
      const roundStartTime = Date.now();``

      await runRound(); // Wait for full round (phases 1–3) to complete

      const elapsed = Date.now() - roundStartTime;
      const remaining = Math.max(0, ROUND_INTERVAL - elapsed);

      console.log(
        `\n🧮 Round duration: ${elapsed}ms | Waiting ${remaining}ms before next round...\n`
      );

      // Recalculate next alignment to reduce drift
      const nextDelay = getNextAlignedDelay(ROUND_INTERVAL);
      setTimeout(runSequentialRounds, nextDelay);
    }, delay);
  }
  /**
   * One full 10-minute round
   */
  async function runRound() {
    return new Promise((resolve) => {
      roundStart = Date.now();
      console.log(`\n🌐 Starting new round at ${roundStart}`);

      // ---- Phase 1 ----
      phase1();
      console.log(`🌱 Phase 1 started (bid generation)`);

      // ---- Phase 2 ----
      setTimeout(() => {
        const bidCount = bidManager.bidList.get(bidManager.round)?.length || 0;
        console.log(
          `📜 Collected ${bidCount} bids so far for round ${bidManager.round}`
        );
        console.log(`🕓 Phase 2 started`);
        phase2();
      }, PHASE_1_DURATION);

      // ---- Phase 3 ----
      setTimeout(async () => {
        console.log(`🚀 Phase 3 started`);
        await phase3();

        const roundEndTime = Date.now();
        console.log(
          `✅ Round ${bidManager.round} completed at ${roundEndTime}`
        );
        resolve(); // ✅ Signals that the round is complete
      }, PHASE_3_START);
    });
  }

  function generateAndSendSensorData() {
    sensor_id = "sensor-" + Math.floor(Math.random() * 1000);
    reading = {
      value: parseFloat((Math.random() * 100).toFixed(2)),
    };
    metadata = {
        timestamp: Date.now(),
        unit: "Celsius"
    };

    const tx = wallet.createTransaction(sensor_id, reading, tp, metadata);
    p2pServer.broadcastTransaction(tx);
    console.log(
      "✨: Generated and broadcasted sensor data related to sensor-id: ",
      sensor_id
    );
  }

  ENABLE_SENSOR_SIM ? setInterval(generateAndSendSensorData, 60000) : console.log("❌ Sensor data simulation disabled");


  function startPoLRoundScheduler() {
    console.log(`\n🕣 Current time: ${Date.now()}`);
    const delay = getNextAlignedDelay(ROUND_INTERVAL); //20 seconds
    console.log(`⏱ First round starts in ${delay / 1000}s`);

    let round = blockchain.getLastBlock().luckProof?.round + 1 || 1;

    setTimeout(() => {
      runPoLRound(++round); //run first round immediately
      setInterval(() => runPoLRound(++round), ROUND_INTERVAL); //  it runs this in every 20 seconds
    }, delay); //waits delay ms
  }

  function runPoLRound(round) {
    const roundStart = Date.now();
    console.log(
      `\n🌐 New round ${round} started at ${Date.now()}`
    );

    const proposal = luckNode.createProposalWithLuck(round);
    p2pServer.lastGeneratedProposal = proposal;

    tp.removeConfirmedTransactionsForPoL(proposal.block.transactions);

    console.log(
      `Round ${round}: generated proposal luck=${proposal.block.luckProof.luck.toFixed(
        6
      )}`
    );

    const delay = Math.max(
      0,
      roundStart + PROPOSAL_SCHEDULE_DELAY - Date.now()
    );

    setTimeout(() =>
      p2pServer.scheduleProposalBroadcast(proposal),   
    delay);
  }

  function cleanupPendingTransactions(cleanUpTime) {
    const pendingMap = tp.pendingTransactions;
    pendingMap.forEach((tx, txId) => {
      if (tx.timestamp < cleanUpTime) {
        pendingMap.delete(txId);
        console.log(`🧹 Removed pending transaction ${txId} with sensor-id ${tx.sensor_id} older than cleanup time ${cleanUpTime}`);
      }
    });
  }

};

startServer();
