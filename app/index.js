const express = require("express");
const bodyParser = require("body-parser");
const Block = require("../blockchain/block");
const Blockchain = require("../blockchain/index");
const Wallet = require("../wallet");
const TransactionPool = require("../transaction/transaction-pool");
const BidManager = require("../bid/bid-manager");
const P2PServer = require("./p2p-server");
const consensus = require("../bid/consensus");

const {
  ROUND_INTERVAL,
  PHASE_1_DURATION,
  PHASE_3_START,
} = require("../config");
const PORT = process.env.PORT || 3001;
var round_start;

const app = express();

const startServer = async () => {
  app.use(bodyParser.json());

  const wallet = await Wallet.loadOrCreate();
  const blockchain = await Blockchain.create(wallet);
  const tp = new TransactionPool();
  const bidManager = new BidManager(wallet.publicKey, blockchain); 
  const p2pServer = new P2PServer(blockchain, tp,bidManager);

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
    bidManager.round += 1;
    const bidPacket= bidManager.generateBid(bidManager.round, wallet);
    p2pServer.broadcastBid(bidPacket);
    console.log(`Round: ${bidPacket.round}`);
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
    console.log(`COnsidering round: ${bidManager.round}`);
    p2pServer.broadcastBlock(bidManager.round, wallet);
  }

  /**
   * Start a round-aligned loop
   */
  function startRoundScheduler() {
    console.log(`TIme now: ${new Date().toISOString()}`)
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
    round_start = Date.now();
    bidManager.startPhase1();
    console.log(`\n🌐 Starting new round at ${new Date().toISOString()}`);

    phase1(); // Immediately run phase 1
    console.log(`🌐 Bid generation and broadcasting done at ${new Date().toISOString()}`);
    console.log(`ROund: ${bidManager.round}`);  
    // Phase 2 starts after 2 minutes
    setTimeout(() => {
      console.log(`Collected ${bidManager.bidList.get(bidManager.round).length} bids so far for round ${bidManager.round}`);
      console.log(`Bids: ${JSON.stringify(bidManager.bidList)}`);
      console.log(`\n🌐 Phase 2 starting at ${new Date().toISOString()}`);
      phase2();
    }, PHASE_1_DURATION);

    // Phase 3 starts at 9-minute mark
    setTimeout(() => {
      console.log(`\n🌐 Phase 3 starting at ${new Date().toISOString()}`);
      console.log(`🌐 Collected ${bidManager.bidList.get(bidManager.round).length} bids for round ${bidManager.round}`);
      phase3();
    }, PHASE_3_START);

    
  }

  startRoundScheduler();
};

startServer();
