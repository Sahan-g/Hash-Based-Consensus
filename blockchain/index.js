const Block = require('./block');
const db = require('../database');
const { blockchainWallet } = require('../wallet');
const ChainUtil = require('../chain-util');
const BidManager = require('../bid/bid-manager');

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

    async addBlockToChain(block, p2pServer) {
        // console.log(this.chain);
        const lastBlock = this.getLastBlock();
        
        // Check if block already exists
        if (this.chain.some(b => b.hash === block.hash)) {
            console.log(`⏭️ Block with hash ${block.hash.substring(0, 8)}... already exists in chain. Skipping.`);
            return false;
        }
        
        // Check if block index is too old
        if (block.index <= lastBlock.index) {
            console.log(`⏭️ Block index ${block.index} is not greater than current last block ${lastBlock.index}. Skipping.`);
            return false;
        }
        
        console.log(`📝 Attempting to add block ${block.index} to chain (current last: ${lastBlock.index})`);
        
        if (p2pServer.targetHashForRound == null) {
            console.log(`❌❌❌ No target hash set for current round.`);   
            console.log(`⏳ Waiting for target hash...`);
            try {
                await this.waitForTargetHash(p2pServer);
                console.log(`✅ Target hash received`);
            } catch (err) {
                console.log(`❌ ${err.message}`);
                // this.goForVoting(p2pServer, block);
                return false;
            }
        }

        if ((p2pServer.targetHashForRound != null && block.hash !== p2pServer.targetHashForRound)) {
            console.log(`\n❌ Block hash ${block.hash.substring(0,8)}... `);
            console.log(`❌ does not match target hash ${p2pServer.targetHashForRound.substring(0,8)}.... Rejecting block at ${Date.now()}`);
            // console.log(`Current received blocks: ${JSON.stringify(this.receivedBlocks)}`);
            return false;
        
        } 

        if (p2pServer.targetProposerForRound != null && block.proposerPublicKey != p2pServer.targetProposerForRound) {
            console.log(`❌ Block proposer ${block.proposerPublicKey} does not match target proposer ${p2pServer.targetProposerForRound}. Rejecting block at ${Date.now()}`);
            // console.log(`Current received blocks: ${JSON.stringify(this.receivedBlocks)}`);
            // this.goForVoting(p2pServer, block);
            return false;
        }

        if (Block.verifyBlock(block) && Block.isValidBlock(block, lastBlock)) {
            this.chain.push(block);
            await db.saveChain(this.chain);
            console.log(`👍 Block ${block.index} added to chain and saved to DB.`);
            return true;
        } else {
            console.log(`❌ Invalid block ${block.index}. Not added to chain.`);
            return false;
        }
    }

    waitForTargetHash(p2pServer, timeoutMs = 1000, intervalMs = 20) {
        return new Promise((resolve, reject) => {
            const start = Date.now();

            const check = () => {
            if (p2pServer.targetHashForRound != null) {
                return resolve(p2pServer.targetHashForRound);
            }
            if (Date.now() - start > timeoutMs) {
                return reject(new Error("Timeout waiting for targetHashForRound"));
            }
            setTimeout(check, intervalMs);
            };

            check();
        });
    }

    isChainValid(chain) {
        if(chain.length === 1) {
            return true;
        }
        for (let i = 1; i < chain.length; i++) {
            const currentBlock = Block.fromObject(chain[i]);
            const previousBlock = Block.fromObject(chain[i - 1]);
            
            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }

            const blockString = currentBlock.index + JSON.stringify(currentBlock.transactions) + currentBlock.previousHash + JSON.stringify(currentBlock.bidHashList);
            const currentBlockHash = ChainUtil.createHash(blockString);
            if (currentBlockHash !== currentBlock.hash) {
                console.log(`Invalid hash at block ${i}: computed ${currentBlockHash}, expected ${currentBlock.hash}`);
                return false;
            }
        }
        console.log("👍 Chain is valid");

        return true;
    }

    async replaceChain(newChain, bidManager) {
        if (newChain.length <= this.chain.length) {
            console.log('📛 Received chain is not longer than the current chain. Ignoring.');
            return;
        }

        if (!this.isChainValid(newChain)) {
            console.log('📛 Received chain is invalid. Ignoring.');
            return;
        }

        console.log('🔁 Replacing current chain with new chain.');
        const oldLength = this.chain.length;
        this.chain = newChain;
        await db.saveChain(this.chain);
        
        // Update bid manager round to match new chain
        if (bidManager) {
            const newRound = this.getLastBlock().index + 1;
            bidManager.handleRound(newRound);
            console.log(`🔄 Updated bid manager to round ${newRound}`);
        }
        
        console.log(`✅ Chain replaced: ${oldLength} -> ${this.chain.length} blocks and saved to DB.`);
        
    }

    removeLastBlock() {
        if(this.chain.length > 1) {
            this.chain.pop();
        }
    }

}

module.exports = Blockchain;