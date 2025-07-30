const crypto = require('crypto');

class Block {
    constructor({index, timestamp, transactions, previousHash, proposerPublicKey, hash}) {
        this.index = index; 
        this.timestamp = timestamp;
        this.transactions = transactions; 
        this.previousHash = previousHash; 
        this.proposerPublicKey = proposerPublicKey; 
        this.hash = hash || this.computeHash();
    }

    computeHash() {
        const blockString = this.index + this.timestamp + JSON.stringify(this.transactions) + this.previousHash + this.proposerPublicKey;
        return crypto.createHash('sha256').update(blockString).digest('hex');
    }

    static genesis() {
        return new Block({
            index: 0,
            timestamp: Date.now(),
            transactions: [],
            previousHash: '0',
            proposerPublicKey: 'GENESIS',
            hash: '0000ed9e07bf3d957688ed7ac3b93aa78c24afaad55056818faab9f03be9aaec'
        });
    }

    static verifyBlock(block) {
        return true;
    }

    static isValidBlock(block, previousBlock) {
        console.log(block);
        if (block.index !== previousBlock.index + 1) {
            return false;
        }
        if (block.previousHash !== previousBlock.hash) {
            return false;
        }
        if (block.hash !== block.computeHash()) {
            console.log(block.computeHash());
            return false;
        }
        return true;
    }
}

module.exports = Block;

// TODO: Create block considering only transactions happened upto 8 mins
// TODO: Add logic to verify block
// TODO: In validating block, must check timestamp, and verify and validate transactions
// TODO: Replace with proper hashing function from ChainUtil
