const webSocket = require("ws");
const axios = require("axios");
const ChainUtil = require("../chain-util");

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

const {NUM_SLOTS, SLOT_MS, MIN_BIDS_REQUIRED, NODE_SYNCING_FREQ} = require("../config");

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
  chain_vote_request: "CHAIN_VOTE_REQUEST",
  chain_vote_response: "CHAIN_VOTE_RESPONSE",
  malicious_data: "MALICIOUS_DATA",
  last_10_blocks: "LAST_10_BLOCKS",
  request_block_vote: "REQUEST_BLOCK_VOTE",
  block_vote_response: "BLOCK_VOTE_RESPONSE",
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
    this.targetBlockForRound = null;
    this.targetProposerForRound = null;
    this.chainVotes = {};
    this.receivedVotes = {};
    this.isVotingInProgress = false;
    // this.receivedBlockAndHash = {};
    this.needBlockHashSync = false;
    this.isVoted = {};
    this.isVoted2 = false;
    this.receivedVoteWithSender = {};
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
    this.sendMaliciousData(socket);
    
    // Log chain status
    console.log(`📊 My chain length: ${this.blockchain.chain.length}, Round: ${this.bidManager.round}`);

    socket.on("close", () => {
      console.log(`❌ Connection to a peer closed`);
      this.sockets = this.sockets.filter((s) => s !== socket);
    });
  }

  messageHandler(socket) {
    socket.on("message", async (message) => {
      const data = JSON.parse(message);
      switch (data.type) {
        case MESSAGE_TYPES.chain:
          console.log(`🛑🛑🛑 Chain received at p2p-server`);
          this.blockchain.replaceChain(data.chain, this.bidManager, this.sockets.length + 1, data.publicKey, data.signature);
          break;
        case MESSAGE_TYPES.last_10_blocks:
          console.log(`🛑🛑🛑 Last 10 blocks received at p2p-server`);
          this.blockchain.replaceLast10Blocks(data.last_10_blocks, this.bidManager, data.publicKey, this.sockets.length + 1, data.signature);
          break;
        case MESSAGE_TYPES.transaction:
          // console.log(`📥 Transaction received with sensor-id-${JSON.stringify(data.transaction.sensor_id)} at p2p-server`);
          this.transactionPool.updateOrAddTransaction(data.transaction);
          break;
        // case MESSAGE_TYPES.clear_transactions: will not be using this
        //     this.transactionPool.clear();
        //     break;
        case MESSAGE_TYPES.block:
          // console.log(`🛑🛑🛑 Block received at p2p-server: ${JSON.stringify(data.block)}`);
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
            const isAdded = await this.blockchain.addBlockToChain2(data.block, this); // Change this if per node voting
            // console.log(`⁉ Block addition result: ${JSON.stringify(isAdded)}`);
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
        case MESSAGE_TYPES.chain_vote_request:
          console.log(
            `🗳 Received chain vote request at p2p-server`
          );
          this.handleChainVoteRequest();
          break;
        case MESSAGE_TYPES.chain_vote_response:
          console.log(
            `🗳 Received chain vote response at p2p-server`
          );
          break;
        case MESSAGE_TYPES.request_block_vote:
          console.log(
            `\n🗳 Received block vote request at p2p-server`
          );
          this.handleBlockVoteRequest2(socket);
          break;
        case MESSAGE_TYPES.block_vote_response:
          console.log(
            `\n🗳 Received block vote response at p2p-server`
          );
          this.handleBlockVoteResponse2(data.hash, data.publicKey, data.signature);
          break;
        case MESSAGE_TYPES.malicious_data:
          console.log(`🛑🛑🛑 Malicious data received at p2p-server`);
          console.log(`👍 Received malicious data: ${JSON.stringify(data.malicious_data)}`);
          console.log(`No.of peers: ${this.sockets.length + 1}`);
          this.blockchain.handleMaliciousData(data.malicious_data, this.sockets.length + 1, data.publicKey, data.signature);
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
        publicKey: this.bidManager.selfPublicKey,
        signature: this.wallet.sign(ChainUtil.createHash(JSON.stringify(this.blockchain.chain))),

      })
    );
    console.log("➡️ Sent chain to peer: ", this.blockchain.chain);
  }

  sendLast10Blocks(socket) {
    socket.send(
      JSON.stringify({
        type: MESSAGE_TYPES.last_10_blocks,
        last_10_blocks: this.blockchain.chain.slice(-NODE_SYNCING_FREQ),
        publicKey: this.bidManager.selfPublicKey,
        signature: this.wallet.sign(ChainUtil.createHash(JSON.stringify(this.blockchain.chain.slice(-NODE_SYNCING_FREQ))))
      })
    );
    console.log("➡️ Sent last 10 blocks to peer");
  }

  sendTransaction(socket, transaction) {
    socket.send(
      JSON.stringify({ type: MESSAGE_TYPES.transaction, transaction })
    );
  }

  sendChainVoteRequest(socket, chainHashSummary) {
    socket.send(
      JSON.stringify({ type: MESSAGE_TYPES.chain_vote_request, chainSummary: chainHashSummary })
    );
  }

  sendChainVoteResponse(socket, voteResponse) {
    socket.send(
      JSON.stringify({ type: MESSAGE_TYPES.chain_vote_response, chainSummary: voteResponse })
    );
  }

  syncChains() {
    this.sockets.forEach((socket) => {
      this.sendChain(socket);
    });
  }

  syncLast10Blocks() {
    const localLast10Blocks = this.blockchain.chain.slice(-NODE_SYNCING_FREQ);
    this.blockchain.receivedLast10BlocksWithSender[this.wallet.publicKey] = localLast10Blocks;
    const simplifiedBlocks = localLast10Blocks.map(block => ({
        index: block.index,
        transactions: block.transactions,
        proposerPublicKey: block.proposerPublicKey,
        bidHashList: block.bidHashList,
        hash: block.hash,
        previousHash: block.previousHash
    }));

    this.blockchain.receivedLast10BlocksWithSender[this.wallet.publicKey] = localLast10Blocks;
    const hashKey = ChainUtil.createHash(JSON.stringify(simplifiedBlocks));
    // const hashKey = JSON.stringify(newLast10Blocks);
    this.blockchain.receivedLast10Blocks[hashKey] = (this.blockchain.receivedLast10Blocks[hashKey] || 0) + 1;
    console.log(`🛑🛑🛑 Recorded own last 10 blocks with hash key ${hashKey} at p2p-server`);
    this.sockets.forEach((socket) => {
      this.sendLast10Blocks(socket);
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
    // console.log(this.transactionPool);
    
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
    
    // const block = new Block({
    //   index: this.blockchain.getLastBlock().index + 1,
    //   transactions,
    //   previousHash: this.blockchain.getLastBlock().hash,
    //   proposerPublicKey: this.bidManager.selfPublicKey,
    //   wallet: wallet,
    // });
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
      
      const isAdded = await this.blockchain.addBlockToChain2(block, this); // Change this if per node voting 
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

  // async initiateVotingForBlock(block) {
  //   this.needBlockHashSync = true;
  //   this.isVotingInProgress = true;
  //   console.log(`\n🗳️ Initiating voting for block ${block.index} (hash: ${block.hash.substring(0,8)}...)`);
  //   // 1️⃣ Broadcast voting request to all peers
  //   const votingRequest = {
  //       type: 'REQUEST_BLOCK_VOTE',
  //   };
  //   this.broadcastBlockVoteRequest(votingRequest);

  //   this.receivedVotes[this.targetHashForRound] = (this.receivedVotes[this.targetHashForRound] || 0) + 1;; // our own vote
    
  //   this.receivedVoteWithSender[this.bidManager.selfPublicKey] = this.targetHashForRound;
  //   // this.isVoted[this.bidManager.selfPublicKey] = this.targetHashForRound;
  //   // this.receivedBlockAndHash[block.hash] = block; // store
  //   const majorityThreshold =  Math.ceil((2 / 3) * (this.sockets.length + 1));
  //   console.log(`1️⃣ Majority Threshold: ${majorityThreshold}`);
  //   console.log(`🗳️ No. of peers: ${this.sockets.length + 1}`);
  //   while (true && this.isVotingInProgress) {
  //     const sorted = Object.entries(this.receivedVotes).sort((a, b) => b[1] - a[1]);
  //     const [majorityHash, count] = sorted[0];
  //       if (count >= majorityThreshold) {
  //         console.log(`✅ Block ${block.index} reached majority ${JSON.stringify(majorityHash)} with ${count} votes (threshold: ${majorityThreshold})`);
  //         this.isVotingInProgress = false;
  //         this.needBlockHashSync = false;
  //         this.isVoted = {};
  //         return majorityHash;
  //     }

  //     // Let Node.js process socket messages
  //     await new Promise(resolve => setTimeout(resolve, 10));
  //   }
  // }

  initiateVotingForBlock2(block) {
    console.log(`\n🗳️ Initiating voting for block ${block.index} (hash: ${block.hash.substring(0,8)}...)`);
    if (this.isVotingInProgress) {
      console.log('🗳️ Vote is not needed or already voted');
      return;
    }
    this.isVotingInProgress = true;
    // 1️⃣ Broadcast voting request to all peers
    const votingRequest = {
        type: 'REQUEST_BLOCK_VOTE',
    };
    this.broadcastBlockVoteRequest(votingRequest);
    const votingResponse ={ 
      type: 'BLOCK_VOTE_RESPONSE',
      hash: this.targetHashForRound, 
      publicKey: this.bidManager.selfPublicKey,
      signature: this.wallet.sign(this.targetHashForRound),
    };
    this.sendBlockVoteResponse2(votingResponse);
    // console.log(`🗳️ Handled block vote request`);
    
    this.blockchain.receivedBlocks[this.bidManager.selfPublicKey] = this.targetHashForRound;
    if (!this.receivedVoteWithSender[this.bidManager.selfPublicKey]) {
      this.receivedVotes[this.targetHashForRound] = (this.receivedVotes[this.targetHashForRound] || 0) + 1;
      this.receivedVoteWithSender[this.bidManager.selfPublicKey] = this.targetHashForRound;
      // console.log(`Received Votes so far: ${JSON.stringify(this.receivedVotes)}`);
    }
    
    // console.log(`Received blocks: ${JSON.stringify(this.blockchain.receivedBlocks)}`);
  }

  // handleBlockVoteRequest(socket) {
  //   if (this.isVoted[socket]) {
  //     console.log('🗳️ Vote is not needed or already voted');
  //     return;
  //   }
    
  //   const votingResponse ={ 
  //     type: 'BLOCK_VOTE_RESPONSE',
  //     hash: this.targetHashForRound, 
  //     publicKey: this.bidManager.selfPublicKey,
  //     signature: this.wallet.sign(this.targetHashForRound),
  //   };
  //   this.sendBlockVoteResponse(votingResponse, socket);
  //   console.log(`🗳️ Handled block vote request`);

  // }

  handleBlockVoteRequest2() { 
    if (this.isVotingInProgress) {
      console.log('🗳️ Vote is not needed or already voted');
      return;
    }
    if (!this.receivedVoteWithSender[this.bidManager.selfPublicKey]) {
      this.receivedVotes[this.targetHashForRound] = (this.receivedVotes[this.targetHashForRound] || 0) + 1;
      this.receivedVoteWithSender[this.bidManager.selfPublicKey] = this.targetHashForRound;
      // console.log(`Received Votes so far: ${JSON.stringify(this.receivedVotes)}`);
    }
    
    this.blockchain.receivedBlocks[this.bidManager.selfPublicKey] = this.targetHashForRound;
    
    this.isVotingInProgress = true;
    const votingResponse ={ 
      type: 'BLOCK_VOTE_RESPONSE',
      hash: this.targetHashForRound, 
      publicKey: this.bidManager.selfPublicKey,
      signature: this.wallet.sign(this.targetHashForRound),
    };
    this.sendBlockVoteResponse2(votingResponse);
    // console.log(`🗳️ Handled block vote request`);
  }

  // handleBlockVoteResponse(hash, publicKey, signature) {
  //   this.isVotingInProgress = true;
  //   // console.log('🗳️ Trying to handle block vote response');
  //   if (!this.needBlockHashSync) {
  //     console.log(`🗳️ Ignoring block vote response as it was not requested`);
  //     return;
  //   }
  //   // console.log('🗳️ Must handle vote Response');
  //   if (this.receivedVoteWithSender[publicKey]) {
  //     console.log(`🗳️ Ignoring duplicate vote from ${publicKey}`);
  //     // TODO: could mark this as malicious behaviour
  //     return;
  //   }
  //   if (!ChainUtil.verifySignature(publicKey, signature, hash)) {
  //     console.log(`🗳️ Ignoring invalid signature from ${publicKey}`);
  //     // TODO: could mark this as malicious behaviour
  //     return;
  //   }

  //   this.receivedVotes[hash] = (this.receivedVotes[hash] || 0) + 1;
  //   this.receivedVoteWithSender[publicKey] = hash;
    
  //   console.log(`🗳️ Handled block vote response`);

  // }

  handleBlockVoteResponse2(hash, publicKey, signature) {
    // console.log('🗳️ Must handle vote Response');

    let majorityThreshold =  Math.ceil((2 / 3) * (this.sockets.length + 1));
    // console.log(`1️⃣ Majority Threshold: ${majorityThreshold}`);
    // console.log(`🗳️ No. of peers: ${this.sockets.length + 1}`);
    // console.log(`Received Votes so far: ${JSON.stringify(this.receivedVotes)}`);

    if (!this.receivedVoteWithSender[this.bidManager.selfPublicKey]) {
      this.receivedVotes[this.targetHashForRound] = (this.receivedVotes[this.targetHashForRound] || 0) + 1;
      this.blockchain.receivedBlocks[this.bidManager.selfPublicKey] = this.targetHashForRound;
      this.receivedVoteWithSender[this.bidManager.selfPublicKey] = this.targetHashForRound;
    }

    let sorted = Object.entries(this.receivedVotes).sort((a, b) => b[1] - a[1]);
    let majorityHash = null;
    let count = 0;

    // console.log('🗳️ Must handle vote Response');
    if (this.receivedVoteWithSender[publicKey]) {
      console.log(`🗳️ Ignoring duplicate vote from ${publicKey}`);
      return;
    }

    if (!ChainUtil.verifySignature(publicKey, signature, hash)) {
      console.log(`🗳️ Ignoring invalid signature from ${publicKey}`);
      return;
    }
    this.isVotingInProgress = true;
    if (!this.receivedVoteWithSender[publicKey]) {
      this.receivedVotes[hash] = (this.receivedVotes[hash] || 0) + 1;
      // console.log(`Received Votes so far: ${JSON.stringify(this.receivedVotes)}`);
      this.receivedVoteWithSender[publicKey] = hash;
    }
    this.blockchain.receivedBlocks[publicKey] = hash;
    // console.log(`Received blocks: ${JSON.stringify(this.blockchain.receivedBlocks)}`);
    
    
    // console.log(`🗳️ Handled block vote response`);

    majorityThreshold =  Math.ceil((2 / 3) * (this.sockets.length + 1));
    // console.log(`1️⃣ Majority Threshold: ${majorityThreshold}`);
    // console.log(`🗳️ No. of peers: ${this.sockets.length + 1}`);

    sorted = Object.entries(this.receivedVotes).sort((a, b) => b[1] - a[1]);
    [majorityHash, count] = sorted[0];
    if (count >= majorityThreshold) {
      if (Object.keys(this.receivedVoteWithSender).length < ((this.sockets.length + 1) - this.blockchain.blacklisted.size)) {
        console.log(`⏳ Waiting for more votes ...`);
        return;
      }
      console.log(`✅ Reached majority ${JSON.stringify(majorityHash)} with ${count} votes (threshold: ${majorityThreshold})`);
      this.blockchain.majorityReachedFunc(majorityHash);
      return;
    }
  }

  initiateVotingForChain(receivedChain) {
    console.log("🗳 Initiating chain voting process...");
    const chainHashSummary = receivedChain.map(block => block.hash);
    this.sockets.forEach((socket) => this.sendChainVoteRequest(socket, chainHashSummary));
  }

  handleChainVoteRequest() {
    console.log("🗳 Handling chain vote request...");
    const localChainHashSummary = this.blockchain.chain.map(block => block.hash);
    this.sockets.forEach((socket) => this.sendChainVoteResponse(socket, localChainHashSummary));
  }

  handleChainVoteResponse(voteResponse) {
        const hashKey = JSON.stringify(voteResponse.chainSummary);
        this.chainVotes[hashKey] = (this.chainVotes[hashKey] || 0) + 1;

        const totalVotes = Object.values(this.chainVotes).reduce((a, b) => a + b, 0);
        const majority = Math.max(...Object.values(this.chainVotes)) > totalVotes / 2;
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

  sendMaliciousData(socket) {
    const maliciousData = {
        counts: this.blockchain.maliciousCount,
        blacklisted: Array.from(this.blockchain.blacklisted),
      };
    console.log(`👍 malicious data before sending: ${JSON.stringify(maliciousData)}`);
    socket.send(JSON.stringify({ 
      type: MESSAGE_TYPES.malicious_data, 
      malicious_data: maliciousData,
      publicKey: this.bidManager.selfPublicKey,
      signature: this.wallet.sign(ChainUtil.createHash(JSON.stringify(maliciousData)))
    }));
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

  broadcastBlockVoteRequest(votingRequest) {
    this.sockets.forEach((socket) => {
      socket.send(JSON.stringify(votingRequest));
    });
    console.log(`📣 Broadcast voting request to all peers`);
  }

  sendBlockVoteResponse(votingResponse, socket) {
    this.isVoted[socket] = true;
    socket.send(JSON.stringify(votingResponse));
    // this.sockets.forEach((socket) => {
    //   socket.send(JSON.stringify(votingResponse));
    // });
    // console.log(`📣 Broadcast voting response ${JSON.stringify(votingResponse)} to all peers`);
    console.log(`📣 Broadcast voting response to all peers`);
  }

  sendBlockVoteResponse2(votingResponse) {
    this.isVoted = true;
    // socket.send(JSON.stringify(votingResponse));
    this.sockets.forEach((socket) => {
      socket.send(JSON.stringify(votingResponse));
    });
    // console.log(`📣 Broadcast voting response ${JSON.stringify(votingResponse)} to all peers`);
    console.log(`📣 Broadcast voting response to all peers`);
  }
}

module.exports = P2PServer;
