const Block = require('./block');
const db = require('../database');
const { blockchainWallet } = require('../wallet');

class Blockchain {
    constructor() {
        this.chain = []; 
    }

    static async create(wallet) {
        const blockChain = new Blockchain();
        let chainFromDB = await db.getChain();

        if(chainFromDB && chainFromDB.length > 0) {
            console.log("Blockchain loaded from DB.");
            blockChain.chain = chainFromDB.map(blockData => Block.fromObject(blockData));
        } else {
            console.log("No blockchain found in DB. Creating genesis block...");
            const genesisBlock = Block.genesis(wallet);
            blockChain.chain.push(genesisBlock);
            await db.saveChain(blockChain.chain);
        }

        return blockChain;
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1]; 
    }

    async addBlock(block) {
        if (Block.verifyBlock(block) && Block.isValidBlock(block, this.getLastBlock())) {
            this.chain.push(block);
            await db.saveChain(this.chain);
        } else {
            throw new Error('Invalid block');
        }
    }

    isChainValid(chain) {
        for (let i = 1; i <= chain.length; i++) {
            const currentBlock = chain[i];
            const previousBlock = chain[i - 1];
            
            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }

            const currentBlockHash = currentBlock.computeHash();
            if (currentBlockHash !== currentBlock.hash) {
                return false;
            }
        }

        return true;
    }

    async replaceChain(newChain) {
        if (newChain.length < this.chain.length) {
            console.log('Received chain is not longer than the current chain. Ignoring.');
            return;
        }

        if (!this.isChainValid(newChain)) {
            console.log('Received chain is invalid. Ignoring.');
            return;
        }

        console.log('Replacing current chain with new chain.');
        this.chain = newChain;
        await db.saveChain(this.chain);
        console.log('Replaced chain and saved it to DB.');
    }


}

module.exports = Blockchain;