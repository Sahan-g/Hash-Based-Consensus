const ChainUtil = require('../chain-util');

class Block {
    constructor({index, timestamp, transactions, previousHash, proposerPublicKey, hash, signature, wallet}) {
        this.index = index; 
        this.timestamp = timestamp;
        this.transactions = transactions; 
        this.previousHash = previousHash; 
        this.proposerPublicKey = proposerPublicKey; 
        this.hash = hash ? hash : this.computeHash();
        this.signature = signature ? signature : wallet.sign(this.hash);
    }

    computeHash() {
        const blockString = this.index + JSON.stringify(this.transactions) + this.previousHash + this.proposerPublicKey;
        return ChainUtil.createHash(blockString);
    } // removed timestamp

    static genesis(wallet) {
        return new Block({
            index: 0,
            timestamp: Date.now(),
            transactions: [],
            previousHash: '0',
            proposerPublicKey: 'GENESIS',
            hash: '0000ed9e07bf3d957688ed7ac3b93aa78c24afaad55056818faab9f03be9aaec',
            wallet: wallet
        });
    }

    static verifyBlock(block) {
        if (block.hash !== block.computeHash()) {
            return false;
        }
        if (!ChainUtil.verifySignature(block.proposerPublicKey, block.signature, block.hash)) {
            return false;
        }
        console.log("Block verified successfully");
        return true;
    }

    static isValidBlock(block, previousBlock) {
        if (block.index !== previousBlock.index + 1) {
            console.log("Invalid block index");
            return false;
        }
        if (block.previousHash !== previousBlock.hash) {
            console.log("Invalid previous hash");
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

// TODO: Create block considering only transactions happened upto 8 mins
// TODO: In validating block, must check timestamp, whether it happened at or before 8 mins
