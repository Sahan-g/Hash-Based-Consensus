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
} = require("../bid/consensus.js");
const Block = require("../blockchain/block");
const BidManager = require("../bid/bid-manager.js");

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

    // Broadcast scheduling parameters
    this.NUM_SLOTS = 10; // number of slots per round
    this.SLOT_MS = 50; // each slot = 50ms → max 5s wait
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
          this.transactionPool.updateOrAddTransaction(data.transaction);
          break;
        // case MESSAGE_TYPES.clear_transactions: will not be using this
        //     this.transactionPool.clear();
        //     break;
        case MESSAGE_TYPES.block:
          console.log(
            `📥 Block received with index ${JSON.stringify(
              data.block.index
            )} at p2p-server}`
          );
          const isAdded = this.blockchain.addBlockToChain(data.block);
          if (isAdded) {
            this.transactionPool.removeConfirmedTransactions(
              data.block.transactions
            );
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
            this.luckConsensus.verifyAndEvaluateProposal(data.proposal);
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

  broadcastBlock(round, wallet) {
    console.log("hit");
    console.log(this.transactionPool);
    const transactions = this.transactionPool.getTransactionsForRound(
      this.transactionPool,
      wallet,
      this.bidManager.round
    );
    const bidList = this.bidManager.bidList;
    const block = new Block({
      index: this.blockchain.getLastBlock().index + 1,
      transactions,
      previousHash: this.blockchain.getLastBlock().hash,
      proposerPublicKey: this.bidManager.selfPublicKey,
      wallet: wallet,
    });
    const hashTableWithBids = transformBidManagerToHashTable(bidList, round);
    const proposerPublicKey = findClosestBidPublicKey(
      hashTableWithBids,
      block.hash
    );
    console.log(
      `🌐 Proposer for this round (${round}) is ${proposerPublicKey}`
    );
    console.log(`🌐 Hash of the block to be proposed: ${block.hash}`);

    if (proposerPublicKey === this.bidManager.selfPublicKey) {
      console.log(
        `✅ Selected as the proposer for this round. Broadcasting and adding block`
      );
      this.blockchain.addBlockToChain(block);
      this.transactionPool.removeConfirmedTransactions(block.transactions);
      this.sockets.forEach((socket) => {
        socket.send(JSON.stringify({ type: MESSAGE_TYPES.block, block }));
      });
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

    let slotIndex = Math.floor((1 - luck) * this.NUM_SLOTS);
    if (slotIndex < 0) slotIndex = 0;
    if (slotIndex >= this.NUM_SLOTS) slotIndex = this.NUM_SLOTS - 1;

    const slotStart = slotIndex * this.SLOT_MS;
    const jitter = Math.floor(Math.random() * this.SLOT_MS);
    const waitMs = slotStart + jitter;

    console.log(
      `🕒 Scheduling proposal for round ${
        proposal.round
      } with luck ${luck.toFixed(6)} into slot ${slotIndex} (wait ${(
        waitMs / 1000
      ).toFixed(3)}s)`
    );

    setTimeout(() => {
      console.log(
        `📣 Broadcasting proposal (round ${proposal.round}) from slot ${slotIndex}`
      );
      this.broadcastProposal(proposal);

      // locally apply (verify & evaluate) our own proposal as it is broadcast
      if (this.luckConsensus) {
        this.luckConsensus.verifyAndEvaluateProposal(proposal);
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
}

module.exports = P2PServer;
