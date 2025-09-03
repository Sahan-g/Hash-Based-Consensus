const webSocket = require('ws');
const axios = require('axios');

const P2P_PORT = process.env.P2P_PORT || 5001;
const selfAddress = `ws://localhost:${P2P_PORT}`;
const{ findClosestBidPublicKey, transformBidManagerToHashTable } = require("../bid/consensus.js")
const Block = require('../blockchain/block');
const BidManager = require('../bid/bid-manager.js');

// const peers = process.env.PEERS ? process.env.PEERS.split(',') : [];
let peers = [];

const MESSAGE_TYPES = {
    chain: 'CHAIN',
    transaction: 'TRANSACTION',
    clear_transactions: 'CLEAR_TRANSACTIONS',
    block: 'BLOCK',
    round: 'ROUND',
    bid: 'BID',
};

class P2PServer {
    constructor(blockchain, transactionPool,bidManager, wallet) {
        this.blockchain = blockchain;
        this.transactionPool = transactionPool;
        this.sockets = [];
        this.bidManager = bidManager;
        this.wallet= wallet;
    }

    async listen() {
        const server = new webSocket.Server({ port: P2P_PORT });
        server.on('connection', (socket) => { 
            console.log(`🛜 Connected to new peer when CONNECTION event is fired: ${socket.url}`);
            this.connectSocket(socket);
        });

        // this.connectToPeers();
       await this.registerToBootstrap();
        console.log(`P2P Server listening on port ${P2P_PORT}`);
    }

    // connectToPeers() {
    //     peers.forEach(peer => {
    //         const socket = new webSocket(peer);
    //         socket.on('open', () => this.connectSocket(socket));
    //     });
    // }
    connectToPeers() {
        peers.forEach(peer => this.connectToPeer(peer));
    }

    connectToPeersFetchedFromBootstrap() {
        peers.forEach(peer => {
            if (peer !== selfAddress) {
                this.connectToPeer(peer)
            }
        });
    }

    async registerToBootstrap() {

        try{
            await axios.post(`http://127.0.0.1:4000/register`, { address: selfAddress });
            console.log(`Registered peer with bootsrap as ${selfAddress}`);
        } catch (error) {
            console.error(`Error registering peer: ${error.message}`);
        }

        try{
            const res = await axios.get(`http://127.0.0.1:4000/peers`);
            peers = res.data;
            if(peers){

                this.connectToPeersFetchedFromBootstrap();
                console.log(`Connected to peers: ${peers}`);
            }
            console.log("skiping no peers")
        } catch (error) {
            console.error(`Error obtaining peers: ${error.message}`);
        }
    }


    connectToPeer(peer) {
        const socket = new webSocket(peer);

        socket.on('open', () => {
            console.log(`🛜 Connected to peer when OPEN event is fired ${peer}`);
            this.connectSocket(socket);
        });

        socket.on('error', () => {
            console.log(`Retrying peer ${peer} in 5s...`);
            setTimeout(() => this.connectToPeer(peer), 5000);
        });


        socket.on('close', () => {

            console.log(`Connection to peer ${peer} closed`);
        });
    }


    connectSocket(socket) {
        this.sockets.push(socket);
        console.log(`New peer connected: ${socket.url}`);
        this.messageHandler(socket);
        this.sendChain(socket)
        //this.sendRound(socket, this.bidManager.round); 
    }

    messageHandler(socket) {
        socket.on('message', message => {
            const data = JSON.parse(message);
            switch (data.type) {
                case MESSAGE_TYPES.chain:
                    // console.log(`\nReceived data: ${JSON.stringify(data.chain)}`)
                    console.log(`BidManager: ${this.bidManager}`);
                    this.blockchain.replaceChain(data.chain, this.bidManager);
                    break;
                case MESSAGE_TYPES.transaction:
                    this.transactionPool.updateOrAddTransaction(data.transaction);
                    break;
                // case MESSAGE_TYPES.clear_transactions: will not be using this 
                //     this.transactionPool.clear();
                //     break;
                case MESSAGE_TYPES.block:
                    console.log(`📥 Block received - ${JSON.stringify(data.block.hash)} with index ${JSON.stringify(data.block.index)} at p2p-server from :${JSON.stringify(socket.url)}`);
                    const isAdded = this.blockchain.addBlockToChain(data.block);
                    if (isAdded) {
                        this.transactionPool.removeConfirmedTransactions(data.block.transactions);
                    }
                    console.log(peers)
                    break;
                case MESSAGE_TYPES.round:
                    console.log(`Received round message: ${JSON.stringify(data.round)}`);// handle received round
                    this.bidManager.handleRound(data.round); 
                    break;
                case MESSAGE_TYPES.bid:
                    // handle received bid
                    console.log(`📥Bid received - ${JSON.stringify(data.bid.bidHash)} at p2p-server from :${JSON.stringify(socket.url)} at ${Date.now()}`);
                    this.bidManager.receiveBid(data.bid);
                    break;
                default:
                    console.error(`Unknown message type: ${data.type}`);

            }

        });
    }

    sendChain(socket) {
        socket.send(JSON.stringify(
            {
                type: MESSAGE_TYPES.chain,
                chain: this.blockchain.chain
            }));
        // console.log(`➡️ Sent chain to peer: ${JSON.stringify(this.blockchain.chain)}`);
        console.log("➡️ Sent chain to peer");
    }

    sendTransaction(socket, transaction) {
        socket.send(JSON.stringify({ type: MESSAGE_TYPES.transaction, transaction }));
    }

    syncChains() {
        this.sockets.forEach(socket => {
            this.sendChain(socket);
        });
    }

    broadcastTransaction(transaction) {
        this.sockets.forEach(socket => this.sendTransaction(socket, transaction));
    }

    broadcastClearTransactions() {
        this.sockets.forEach(socket => {
            socket.send(JSON.stringify({ type: MESSAGE_TYPES.clear_transactions }));
        });
    }

    broadcastBlock(round, wallet) {

       const transactions =  this.transactionPool.getTransactionsForRound(this.transactionPool);
       const bidList= this.bidManager.bidList;
       const block = new Block({index: this.blockchain.getLastBlock().index + 1, transactions, previousHash: this.blockchain.getLastBlock().hash, proposerPublicKey: this.bidManager.selfPublicKey, wallet: wallet});
       const hashTableWithBids=  transformBidManagerToHashTable(bidList, round);
       const proposerPublicKey = findClosestBidPublicKey(hashTableWithBids, block.hash);
       console.log(`Proposer for this round (${round}) is ${proposerPublicKey}`);
       console.log(`Hash of the block to be proposed: ${block.hash}`);

       if(proposerPublicKey === this.bidManager.selfPublicKey){
            console.log(`✅ I am the proposer for this round. Broadcasting and adding block: ${block.toString()}`);
            this.blockchain.addBlockToChain(block);
            this.transactionPool.removeConfirmedTransactions(block.transactions);
            console.log(`Socket list: ${this.sockets}`);
            this.sockets.forEach(socket => {
                socket.send(JSON.stringify({ type: MESSAGE_TYPES.block, block }));
            });
            return;
       }
       console.log(`⛔ Not the proposer for this round. Proposer is ${proposerPublicKey}, but I am ${this.bidManager.selfPublicKey}. Block not broadcasted.`);
        // console.log(`BROADCASTED: ${block.toString()}`);
    }

    sendRound(socket, round) {
        socket.send(JSON.stringify({ type: MESSAGE_TYPES.round, round }));
    }

    broadcastBid(bidPacket) {
        this.sockets.forEach(socket => {
            socket.send(JSON.stringify({ type: MESSAGE_TYPES.bid, bid: bidPacket }));
        });
    }
    

}

module.exports = P2PServer;