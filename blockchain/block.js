const ChainUtil = require('../chain-util');

class Block {
    constructor({index, timestamp, transactions, previousHash, proposerPublicKey, hash, signature, wallet}) {
        this.index = index; 
        this.timestamp = Date.now();
        this.transactions = transactions; 
        this.previousHash = previousHash; 
        this.proposerPublicKey = proposerPublicKey; 
        this.hash = hash ? hash : this.computeHash();
        this.signature = signature ? signature : wallet.sign(this.hash);
    }

    computeHash() {
        const blockString = this.index + JSON.stringify(this.transactions) + this.previousHash;
        // console.log(`Block string for hashing: ${blockString}`);
        return ChainUtil.createHash(blockString);
    } // removed timestamp

    static genesis(wallet) {
        return new Block({
            index: 0,
            transactions: [],
            previousHash: '0',
            proposerPublicKey: 'GENESIS',
            wallet: wallet
        });
    }

    static verifyBlock(block) {
        const blockString = block.index + JSON.stringify(block.transactions) + block.previousHash;
        if (block.hash !== ChainUtil.createHash(blockString)) {
            console.log("Invalid block hash");
            return false;
        }

        if (!ChainUtil.verifySignature(block.proposerPublicKey, block.signature, block.hash)) {
            console.log("Invalid block signature");
            return false;
        }
        console.log("Block verified successfully");
        return true;
    }

    static isValidBlock(block, previousBlock) {
        if (block.index !== previousBlock.index + 1) {
            console.log(`Invalid block index: ${block.index} expected: ${previousBlock.index + 1}`);
            return false;
        }
        if (block.previousHash !== previousBlock.hash) {
            console.log(`Invalid previous hash: ${block} expected: ${previousBlock}`);
            return false;
        }
        if (block.timestamp <= previousBlock.timestamp) {
            console.log("Invalid timestamp");
            return false;
        }

        console.log("Block is valid");
        return true;
    }

    static fromObject(obj) {
        const { index, timestamp, transactions, previousHash, proposerPublicKey, hash, signature } = obj;
        return new this({index, timestamp, transactions, previousHash, proposerPublicKey, hash, signature});
    }
}

module.exports = Block;
