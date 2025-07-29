const Block = require('./block');

class Blockchain {
    constructor() {
        this.chain = [Block.genesis()]; 
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