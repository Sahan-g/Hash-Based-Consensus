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
        const blockString = this.index + this.timestamp + JSON.stringify(this.transactions) + this.previousHash + this.proposerPublicKey;
        return ChainUtil.createHash(blockString);
    }

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
        return true;
    }

    static isValidBlock(block, previousBlock) {
        if (block.index !== previousBlock.index + 1) {
            return false;
        }
        if (block.previousHash !== previousBlock.hash) {
            return false;
        }

        return true;
    }
}

module.exports = Block;

// TODO: Create block considering only transactions happened upto 8 mins
// TODO: In validating block, must check timestamp
