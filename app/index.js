const express = require('express');
const bodyParser = require('body-parser');
const Block = require('../blockchain/block');
const Blockchain = require('../blockchain/index');

const PORT = process.env.PORT || 3001;

const app = express();

const startServer = () => {
    app.use(bodyParser.json());

    const blockchain = new Blockchain();

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
    
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

startServer();