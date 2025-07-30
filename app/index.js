const express = require("express");
const bodyParser = require("body-parser");
const Block = require("../blockchain/block");
const Blockchain = require("../blockchain/index");

const Wallet = require("../wallet");
const TransactionPool = require("../transaction/transaction-pool");
const { DIFFICULTY } = require("../config");
const BidManager = require('../bid/bid-manager');

const PORT = process.env.PORT || 3001;

const app = express();

const startServer = () => {
  app.use(bodyParser.json());

  // const blockchain = new Blockchain();
  const wallet = new Wallet();
  const tp = new TransactionPool();
    // const bidManager = new BidManager("pubKey");

  // app.post('/createBlock', (req, res) => {
  //     const { index, timestamp, transactions, previousHash, proposerPublicKey } = req.body;
  //     try {
  //         console.log('Creating a new block');
  //         const newBlock = new Block({ index, timestamp, transactions, previousHash, proposerPublicKey });
  //         res.status(201).json(newBlock);
  //     } catch (error) {
  //         res.status(400).json({ error: 'Invalid block data' });
  //     }
  // });

  // app.post('/addBlock', (req, res) => {
  //     const block = req.body;
  //     try {
  //         blockchain.addBlock(new Block(block));
  //         res.status(200).json({ message: 'Block added successfully', block });
  //     } catch (error) {
  //         res.status(400).json({ error: error.message });
  //     }
  // })

  // app.get('/chain', (_req, res) => {
  //     res.status(200).json(blockchain.chain);
  // })

  // app.get("/transactions", (req, res) => {
  //   res.json(tp.transactions);
  // });

  // app.post("/transact", (req, res) => {
  //   const { recipient, amount } = req.body;

  //   if (!recipient || !amount) {
  //     return res.status(400).send("Recipient and amount are required.");
  //   }

  //   const transaction = wallet.createTransaction(
  //     recipient,
  //     amount,
  //     tp,
  //     blockchain
  //   );
  //   if (transaction) {
  //     console.log("Transaction created:", transaction);
  //   }

  //   res.redirect("/transactions");
  // });

  // app.get("/public-key", (req, res) => {
  //   res.json({ publicKey: wallet.publicKey });
  // });

    // app.post('/generateBid', (req, res) => {
    //     const { round } = req.body;
    //     try {
    //         const bidPacket = bidManager.generateBid(round);
    //         res.status(201).json(bidPacket);
    //     } catch (error) {
    //         res.status(400).json({ error: 'Invalid bid data' });
    //     }
    // })

    // app.post('/receiveBid', (req, res) => {
    //     const bidPacket = req.body;
    //     if (bidManager.receiveBid(bidPacket)) {
    //         res.status(200).json({ message: 'Bid received, verified and added successfully' });
    //     } else {
    //         res.status(400).json({ error: 'Invalid bid packet' });
    //     }
    // })

    // app.get('/getBids/:round', (req, res) => {
    //     const { round } = req.params;
    //     const bidList = bidManager.getAllBids(parseInt(round, 10));
    //     if (bidList.length > 0) {
    //         res.status(200).json(bidList);
    //     }
    //     else {
    //         res.status(404).json({ message: 'No bids found for this round' });
    //     }
    // })

    // app.get('/selectProposer', (req, res) => {
    //     const { round, blockHash } = req.body;
    //     const publicKey = bidManager.selectProposer(round, blockHash);
    //     if (publicKey) {
    //         res.status(200).json({ proposerPublicKey: publicKey });
    //     } else {
    //         res.status(404).json({ message: 'No proposer found for this round' });
    //     }
    // })

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();
