const Block = require('./block');

class Blockchain {
    constructor(wallet) {
        this.chain = [Block.genesis(wallet)]; 
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1]; 
    }

    addBlock(block) {
        if (Block.verifyBlock(block) && Block.isValidBlock(block, this.getLastBlock())) {
            this.chain.push(block);
        } else {
            throw new Error('Invalid block');
        }
    }
}

module.exports = Blockchain;