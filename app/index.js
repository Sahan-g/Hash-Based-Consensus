const express = require("express");
const bodyParser = require("body-parser");
const Block = require("../blockchain/block");
const Blockchain = require("../blockchain/index");
const Wallet = require("../wallet");
const TransactionPool = require("../transaction/transaction-pool");
const BidManager = require("../bid/bid-manager");
const P2PServer = require("./p2p-server");

const {
  ROUND_INTERVAL,
  PHASE_1_DURATION,
  PHASE_3_START,
} = require("../config");
const PORT = process.env.PORT || 3001;

const app = express();

const startServer = async () => {
  app.use(bodyParser.json());

  const wallet = await Wallet.loadOrCreate();
  const blockchain = await Blockchain.create(wallet);
  const tp = new TransactionPool();
  const bidManager = new BidManager(wallet.publicKey);
  const p2pServer = new P2PServer(blockchain, tp, bidManager);

  app.get("/blocks", (req, res) => {
    res.json(blockchain.chain);
  });

  app.get("/transaction", (req, res) => {
    res.json(tp.transactions);
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
      p2pServer.broadcastTransaction(tx);

      return res.status(201).json({ ok: true, transaction: tx });
    } catch (err) {
      console.error("Failed to create transaction:", err);
      return res
        .status(500)
        .json({ ok: false, error: err.message || "internal error" });
    }
  });

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  p2pServer.listen();

  p2pServer.syncChains();

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
    const bidPacket = p2pServer.bidManager.generateBid(
      p2pServer.bidManager.round,
      wallet
    );
    p2pServer.broadcastBid(bidPacket);
  }

  /**
   * Phase 2: intermediate phase (2–9 min)
   */
  function phase2() {
    console.log(`[${new Date().toISOString()}] Phase 2: Waiting for leader...`);
    // Collect random numbers, do nothing
  }

  /**
   * Phase 3: block proposal
   */
  async function phase3() {
    p2pServer.broadcastBlock(p2pServer.bidManager.round);
  }

  /**
   * Start a round-aligned loop
   */
  function startRoundScheduler() {
    const delay = getNextAlignedDelay(ROUND_INTERVAL);
    console.log(`First round starts in ${delay / 1000}s`);

    setTimeout(() => {
      runRound(); // first round
      setInterval(runRound, ROUND_INTERVAL); // repeat
    }, delay);
  }

  /**
   * One full 10-minute round
   */
  function runRound() {
    console.log(`\n🌐 Starting new round at ${new Date().toISOString()}`);

    phase1(); // Immediately run phase 1

    // Phase 2 starts after 2 minutes
    setTimeout(() => {
      phase2();
    }, PHASE_1_DURATION);

    // Phase 3 starts at 9-minute mark
    setTimeout(() => {
      phase3();
    }, PHASE_3_START);
  }

  startRoundScheduler();
};

startServer();
