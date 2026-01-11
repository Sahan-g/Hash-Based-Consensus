const webSocket = require("ws");
const axios = require("axios");

const P2P_PORT = process.env.P2P_PORT || 5001;
const BOOTSTRAP_ADDRESS =
  process.env.BOOTSTRAP_ADDRESS || "http://127.0.0.1:4000";
const P2P_HOST = process.env.P2P_HOST || "localhost";
const selfAddress = `ws://${P2P_HOST}:${P2P_PORT}`;
const {
  findClosestBidPublicKey,
  transformBidManagerToHashTable,
  createOptimizedBidArray,
  sortBidsOptimized,
  findClosestBidBinarySearch,
} = require("../bid/consensus.js");
const Block = require("../blockchain/block");

const {NUM_SLOTS, SLOT_MS, MIN_BIDS_REQUIRED} = require("../config");

// const peers = process.env.PEERS ? process.env.PEERS.split(',') : [];
let peers = [];

const MESSAGE_TYPES = {
  chain: "CHAIN",
  transaction: "TRANSACTION",
  clear_transactions: "CLEAR_TRANSACTIONS",
  block: "BLOCK",
  round: "ROUND",
  bid: "BID",
  proposal: "PROPOSAL",
};

class P2PServer {
  constructor(blockchain, transactionPool, bidManager, wallet, luckConsensus) {
    this.blockchain = blockchain;
    this.transactionPool = transactionPool;
    this.sockets = [];
    this.bidManager = bidManager;
    this.wallet = wallet;
    this.luckConsensus = luckConsensus;
    this.lastGeneratedProposal = null;
    this.processingBlocks = new Set(); // Prevent duplicate block processing
    this.targetHashForRound = null;
    this.targetProposerForRound = null;
  }

  async listen() {
    const server = new webSocket.Server({ port: P2P_PORT });
    server.on("connection", (socket) => {
      this.connectSocket(socket);
    });

    await this.registerToBootstrap();
    console.log(`P2P Server listening on port ${P2P_PORT}`);
  }

  connectToPeers() {
    peers.forEach((peer) => this.connectToPeer(peer));
  }

  connectToPeersFetchedFromBootstrap() {
    peers.forEach((peer) => {
      if (peer !== selfAddress) {
        this.connectToPeer(peer);
      }
    });
  }

  async registerToBootstrap() {
    try {
      await axios.post(`${BOOTSTRAP_ADDRESS}/register`, {
        address: selfAddress,
      });
      console.log(
        `Registered peer with bootstrap at ${BOOTSTRAP_ADDRESS} as ${selfAddress}`
      );
    } catch (error) {
      console.error(`Error registering peer: ${error.message}`);
    }

    try {
      const res = await axios.get(`${BOOTSTRAP_ADDRESS}/peers`);
      peers = res.data;
      if (peers) {
        this.connectToPeersFetchedFromBootstrap();
        console.log(`Connected to peers: ${peers}`);
      }
      console.log("skiping no peers");
    } catch (error) {
      console.error(`Error obtaining peers: ${error.message}`);
    }
  }

  connectToPeer(peer) {
    const socket = new webSocket(peer);

    socket.on("open", () => {
      this.connectSocket(socket);
    });

    socket.on("error", () => {
      console.log(`Couldn't connect to peer ${peer}`);
      peers = peers.filter((p) => p !== peer);
      return;
    });
  }

  connectSocket(socket) {
    this.sockets.push(socket);
    console.log(`👨 New peer connected: ${socket.url}`);
    this.messageHandler(socket);
    this.sendChain(socket);
    this.sendRound(socket, this.bidManager.round);
    
    // Log chain status
    console.log(`📊 My chain length: ${this.blockchain.chain.length}, Round: ${this.bidManager.round}`);

    socket.on("close", () => {
      console.log(`❌ Connection to a peer closed`);
      this.sockets = this.sockets.filter((s) => s !== socket);
    });
  }

  messageHandler(socket) {
    socket.on("message", (message) => {
      const data = JSON.parse(message);
      switch (data.type) {
        case MESSAGE_TYPES.chain:
          this.blockchain.replaceChain(data.chain, this.bidManager);
          break;
        case MESSAGE_TYPES.transaction:
          console.log(`📥 Transaction received with sensor-id-${JSON.stringify(data.transaction.sensor_id)} at p2p-server`);
          this.transactionPool.updateOrAddTransaction(data.transaction);
          break;
        // case MESSAGE_TYPES.clear_transactions: will not be using this
        //     this.transactionPool.clear();
        //     break;
        case MESSAGE_TYPES.block:
          const blockHash = data.block.hash;
          
          // Prevent duplicate processing
          if (this.processingBlocks.has(blockHash)) {
            console.log(`⏭️ Block ${blockHash.substring(0, 8)}... already being processed, skipping`);
            return;
          }
          
          this.processingBlocks.add(blockHash);
          
          try {
            console.log(
              `📥 Block received with index ${data.block.index} at p2p-server`
            );
            const isAdded = this.blockchain.addBlockToChain(data.block, this);
            if (isAdded) {
              this.transactionPool.removeConfirmedTransactions(
                data.block.transactions, data.block.proposerPublicKey, this.bidManager.selfPublicKey
              );
              console.log(`✅ Block ${data.block.index} added successfully`);
            } else {
              console.log(`⚠️ Block ${data.block.index} was not added`);
            }
          } finally {
            // Remove from processing set after a delay to prevent immediate re-processing
            setTimeout(() => {
              this.processingBlocks.delete(blockHash);
            }, 1000);
          }
          break;
        case MESSAGE_TYPES.round:
          console.log(
            `📥 Received round message: ${JSON.stringify(data.round)}`
          ); // handle received round
          this.bidManager.handleRound(data.round);
          break;
        case MESSAGE_TYPES.bid:
          console.log(
            `📥 Bid received - ${JSON.stringify(
              data.bid.bidHash
            )} at p2p-server`
          );
          this.bidManager.receiveBid(data.bid);
          break;
        case MESSAGE_TYPES.proposal:
          console.log(
            `📥 Proposal received for round ${data.proposal.round} at p2p-server`
          );
          // this.luckConsensus.verifyAndEvaluateProposal(data.proposal);
          if (this.luckConsensus) {
            this.luckConsensus.verifyAndEvaluateAndAddProposal(data.proposal);
          }
          break;
        default:
          console.error(`Unknown message type: ${data.type}`);
      }
    });
  }

  sendChain(socket) {
    socket.send(
      JSON.stringify({
        type: MESSAGE_TYPES.chain,
        chain: this.blockchain.chain,
      })
    );
    console.log("➡️ Sent chain to peer");
  }

  sendTransaction(socket, transaction) {
    socket.send(
      JSON.stringify({ type: MESSAGE_TYPES.transaction, transaction })
    );
  }

  syncChains() {
    this.sockets.forEach((socket) => {
      this.sendChain(socket);
    });
  }

  broadcastTransaction(transaction) {
    this.sockets.forEach((socket) => this.sendTransaction(socket, transaction));
  }

  broadcastClearTransactions() {
    this.sockets.forEach((socket) => {
      socket.send(JSON.stringify({ type: MESSAGE_TYPES.clear_transactions }));
    });
  }

  async broadcastBlock(round, wallet, roundStart) {
    // console.log("hit");
    console.log(this.transactionPool);
    
    // Check if we have enough bids for this round
    const bidList = this.bidManager.bidList;
    const roundBids = bidList.get(round) || [];
    
    if (roundBids.length < MIN_BIDS_REQUIRED) {
      console.log(`⚠️ Insufficient bids for round ${round}: ${roundBids.length}/${MIN_BIDS_REQUIRED}. Skipping block proposal.`);
      console.log(`⏭️ This prevents nodes from running ahead when they're the only bidder.`);
      return;
    }
    
    console.log(`✅ Sufficient bids collected: ${roundBids.length}/${MIN_BIDS_REQUIRED} for round ${round}`);
    
    const transactions = this.transactionPool.getTransactionsForRound(
      this.transactionPool,
      roundStart
    );

    const hashTableWithBids = transformBidManagerToHashTable(bidList, round);
    const bidArray = createOptimizedBidArray(hashTableWithBids);
    const sortedBids = sortBidsOptimized(bidArray);
    
    const block = new Block({
      index: this.blockchain.getLastBlock().index + 1,
      transactions,
      previousHash: this.blockchain.getLastBlock().hash,
      proposerPublicKey: this.bidManager.selfPublicKey,
      bidHashList: sortedBids.map(bid => ({
        publicKey : bid.publicKey,
        bidValue  : bid.bidValue.toString(),
      })),
      wallet: wallet,
    });

    // console.log(`📦 Generated block`);
    // Log only the sensor IDs of the transactions in the generated block
    const sensorIds = block.transactions.map(tx => tx.sensor_id || tx.id);
    // console.log(`📦 Block ${block.index} contains sensor readings from: ${sensorIds.join(', ')}`);
    // console.log(`📦 Generated block: ${JSON.stringify(block)}`);
    // console.log(`📦 Generated block with index ${JSON.stringify(block.index)} and hash: ${JSON.stringify}`);
    this.targetHashForRound = block.hash;
    // console.log(`🟡 Updated targetHashForRound: ${block.hash} -> ${this.targetHashForRound}`);
    this.targetBlockForRound = block;

    console.log(`\n🌐 Target hash for round ${round} set to: ${this.targetHashForRound} at ${Date.now()}`);

    // const proposerPublicKey = findClosestBidPublicKey(
    //   hashTableWithBids,
    //   block.hash
    // );
    const proposerPublicKey = findClosestBidBinarySearch(sortedBids, this.targetHashForRound);
    this.targetProposerForRound = proposerPublicKey;
    // console.log(`🟡 Updated targetProposerForRound: ${proposerPublicKey} -> ${this.targetProposerForRound}`);
    console.log(
      `🌐 Proposer for this round (${round}) is ${proposerPublicKey}`
    );
    console.log(`🌐 Hash of the block to be proposed: ${block.hash}`);

    if (proposerPublicKey === this.bidManager.selfPublicKey) {
      console.log(
        `✅ Selected as the proposer for this round. Broadcasting and adding block`
      );
      
      // Verify block before adding
      if (!Block.verifyBlock(block)) {
        console.error(`❌ Generated block failed verification!`);
        return;
      }
      
      const isAdded = await this.blockchain.addBlockToChain(block, this); // Change this if per node voting 
      // console.log(`BLOCK JUST ADDED: ${JSON.stringify(this.blockchain.getLastBlock())}`);
      console.log(`BLOCK JUST ADDED`);
      
      if (!isAdded) {
        console.error(`❌ Failed to add own block to chain`);
        return;
      }
      
      this.transactionPool.removeConfirmedTransactions(block.transactions, proposerPublicKey, this.bidManager.selfPublicKey);
      console.log(`📡 Verifying bid list before broadcasting block: ${block.bidHashList}`);
      // Broadcast only after successful local addition
      this.sockets.forEach((socket) => {
        socket.send(JSON.stringify({ type: MESSAGE_TYPES.block, block }));
      });
      
      console.log(`📡 Block ${block.index} broadcast to ${this.sockets.length} peers`);
      return;
    }
    console.log(
      `⛔ Not the proposer for this round. Proposer is ${proposerPublicKey}`
    );
  }

  broadcastProposal(proposal) {
    console.log("✅ Broadcasting proposal for round ", proposal.round);
    this.sockets.forEach((socket) => {
      socket.send(JSON.stringify({ type: MESSAGE_TYPES.proposal, proposal }));
      console.log(
        `✅ Sent proposal for round ${proposal.round} to peer ${socket.url}`
      );
    });
  }

  scheduleProposalBroadcast(proposal) {
    console.log("The proposal: ", proposal);
    if (!proposal || !proposal.block || !proposal.block.luckProof) return;
    let luck = proposal.block.luckProof.luck;
    if (typeof luck !== "number" || Number.isNaN(luck)) luck = 0;

    let slotIndex = Math.floor((1 - luck) * NUM_SLOTS);
    if (slotIndex < 0) slotIndex = 0;
    if (slotIndex >= NUM_SLOTS) slotIndex = NUM_SLOTS - 1;

    const slotStart = slotIndex * SLOT_MS;
    const jitter = Math.floor(Math.random() * SLOT_MS);
    const waitMs = slotStart + jitter;

    console.log(
      `🕒 Scheduling proposal for round ${
        proposal.round
      } with luck ${luck.toFixed(6)} into slot ${slotIndex} (wait ${(
        waitMs / 1000
      ).toFixed(3)}s)`
    );
    console.log("🕒 Slot starts at: ", Date.now() + slotStart, "ms");

    setTimeout(() => {
      if ((this.blockchain.getLastBlock().index + 2 === proposal.round) || (this.blockchain.getLastBlock().index + 1 === proposal.round && this.blockchain.getLastBlock().luckProof.luck < proposal.block.luckProof.luck)) {
        // locally apply (verify & evaluate) our own proposal as it is broadcast
        if (this.luckConsensus) {
          this.luckConsensus.verifyAndEvaluateAndAddProposal(proposal);
        }
        console.log(
          `📣 Broadcasting proposal (round ${proposal.round}) from slot ${slotIndex}`
        );
        this.broadcastProposal(proposal);
      } else {
        console.log(`⛔ Not broadcasting proposal for round ${proposal.round} as there's already a proposal with higher luck value`);
      }  
    }, waitMs);
  }

  sendRound(socket, round) {
    socket.send(JSON.stringify({ type: MESSAGE_TYPES.round, round }));
  }

  broadcastBid(bidPacket) {
    this.sockets.forEach((socket) => {
      socket.send(JSON.stringify({ type: MESSAGE_TYPES.bid, bid: bidPacket }));
    });
  }

  broadcastRound(round) {
    this.sockets.forEach((socket) => {
      socket.send(JSON.stringify({ type: MESSAGE_TYPES.round, round }));
    });
    console.log(`📣 Broadcast current round ${round} to all peers`);
  }
}

module.exports = P2PServer;
