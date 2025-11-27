const Block = require('./block');
const db = require('../database');
const { blockchainWallet } = require('../wallet');
const ChainUtil = require('../chain-util');
const BidManager = require('../bid/bid-manager');
const P2PServer = require('../app/p2p-server');
const {NODE_SYNCING_FREQ} = require('../config');

class Blockchain {
    constructor() {
        this.chain = []; 
        this.maliciousCount = {};
        this.blacklisted = new Set();
        this.receivedMaliciousData = {};
        this.majorityReached = false;
        this.receivedLast10Blocks = {};
        this.majorityLast10Blocks = null;
        this.receivedLast10BlocksWithSender = {};
        this.receivedChains = {};
        this.receivedDifferentChains = {};
        this.receivedChainsWithSender = {};
        this.receivedMaliciousDatasWithSender = {};
        this.receivedBlocks = {};
    }

    static async create(wallet) {
        const blockChain = new Blockchain();
        let chainFromDB = await db.getChain();

        if(chainFromDB && chainFromDB.length > 0) {
            console.log("Blockchain loaded from DB.");
            blockChain.chain = chainFromDB.map(blockData => Block.fromObject(blockData));
            console.log(`✅ Loaded blockchain: ${JSON.stringify(blockChain.chain)}`);
        } else {
            console.log("No blockchain found in DB. Creating genesis block...");
            const genesisBlock = Block.genesis(wallet);
            blockChain.chain.push(genesisBlock);
            await db.saveChain(blockChain.chain);
        }

        const maliciousData = await db.getMaliciousNodes();
        this.maliciousCount = maliciousData.counts || {};
        this.blacklisted = new Set(maliciousData.blacklisted || []);
        console.log("🚀 Loaded malicious node data from DB:", maliciousData);

        return blockChain;
    }

    getLastBlock() {
        return this.chain[this.chain.length - 1]; 
    }

    async addBlockToChain(block, p2pServer) {
        // console.log(this.chain);
        this.receivedBlocks[block.proposerPublicKey] = block.hash;
        const lastBlock = this.getLastBlock();

        if (this.blacklisted.has(block.proposerPublicKey)) {
            console.log(`🚫 Block proposer ${block.proposerPublicKey} is blacklisted. Rejecting block.`);
            return false;
        }
        
        // Check if block already exists
        if (this.chain.some(b => b.hash === block.hash)) {
            console.log(`⏭️ Block with hash ${block.hash.substring(0, 8)}... already exists in chain.`);
            this.goForVoting(p2pServer, block);
            return false;
        }
        
        // Check if block index is too old
        if (block.index <= lastBlock.index) {
            console.log(`⏭️ Block index ${block.index} is not greater than current last block ${lastBlock.index}.`);
            this.goForVoting(p2pServer, block);
            return false;
        }
        
        console.log(`📝 Attempting to add block ${block.index} to chain (current last: ${lastBlock.index})`);

        if (p2pServer.targetHashForRound == null) {
            console.log(`❌❌❌ No target hash set for current round.`);
        }

        if ((p2pServer.targetHashForRound != null && block.hash !== p2pServer.targetHashForRound)) {
            console.log(`\n❌ Block hash ${block.hash.substring(0,8)}... `);
            console.log(`❌ does not match target hash ${p2pServer.targetHashForRound.substring(0,8)}.... Rejecting block at ${Date.now()}`);
            // console.log(`Current received blocks: ${JSON.stringify(this.receivedBlocks)}`);
            this.goForVoting(p2pServer, block);
            return false;
        
        } 
        if (p2pServer.targetProposerForRound != null && block.proposerPublicKey != p2pServer.targetProposerForRound) {
            console.log(`❌ Block proposer ${block.proposerPublicKey} does not match target proposer ${p2pServer.targetProposerForRound}. Rejecting block at ${Date.now()}`);
            // console.log(`Current received blocks: ${JSON.stringify(this.receivedBlocks)}`);
            this.goForVoting(p2pServer, block);
            return false;
        }
        
        if (Block.verifyBlock(block) && Block.isValidBlock(block, lastBlock)) {
            
            if (!p2pServer.receivedVoteWithSender[block.proposerPublicKey]) {
                p2pServer.receivedVotes[block.hash] = (p2pServer.receivedVotes[block.hash] || 0) + 1;
                p2pServer.receivedVoteWithSender[block.proposerPublicKey] = block.hash;
                // console.log(`Received Votes so far: ${JSON.stringify(p2pServer.receivedVotes)}`);
            }
            this.chain.push(block);
            await db.saveChain(this.chain);
            console.log(`👍 Block ${block.index} added to chain and saved to DB.\n`);
            return true;
        } else {
            console.log(`❌ Invalid block ${block.index}. Not added to chain.`);
            return false;
        }
    }

    goForVoting(p2pServer, block) {
        if (!p2pServer.receivedVoteWithSender[block.proposerPublicKey]) {
            p2pServer.receivedVotes[block.hash] = (p2pServer.receivedVotes[block.hash] || 0) + 1;
            p2pServer.receivedVoteWithSender[block.proposerPublicKey] = block.hash;
            // console.log(`Received Votes so far: ${JSON.stringify(p2pServer.receivedVotes)}`);
        }
                
        p2pServer.initiateVotingForBlock(block);
    }

    majorityReachedFunc(majorityHash) {
        // Check whether each received block matches the majority hash
        console.log(`Majority Reached FUnction`);
        for (const [publicKey, hash] of Object.entries(this.receivedBlocks)) {
            if (hash !== majorityHash) {
                console.log(`⚠️ Proposer ${publicKey} sent malicious block!`);
                this.maliciousCount[publicKey] = (this.maliciousCount[publicKey] || 0) + 1;

                // 🚫 Blacklist after 3 malicious acts
                if (this.maliciousCount[publicKey] >= 3) {
                    this.blacklisted.add(publicKey);
                    console.log(`🚫 Proposer ${publicKey} permanently blacklisted.`);
                }
                // 💾 Save updated malicious data
                db.saveMaliciousNodes({
                    counts: this.maliciousCount,
                    blacklisted: Array.from(this.blacklisted)
                });
            }
        }
    }

    isChainValid(chain, p2pServer) {
        console.log("🔍 Validating received chain...");
        if(chain.length === 1) {
            return true;
        }

        for (let i = 1; i < chain.length; i++) {
            const currentBlock = Block.fromObject(chain[i]);
            const previousBlock = Block.fromObject(chain[i - 1]);
            
            if (currentBlock.previousHash !== previousBlock.hash) {
                console.log(`❌ Previous hash and current hash not matching for block ${i}`);
                return false;
            }

            // console.log(`🔗 Current block: ${JSON.stringify(currentBlock)}`);
            // console.log(`🔗 bid list in block ${currentBlock.bidHashList} , ${JSON.stringify(currentBlock.bidHashList)}`);
            const blockString = currentBlock.index + JSON.stringify(currentBlock.transactions) + currentBlock.previousHash + JSON.stringify(currentBlock.bidHashList);
            console.log(`🌟 Validating block string for block ${i}`);
            const currentBlockHash = ChainUtil.createHash(blockString);
            if (currentBlockHash !== currentBlock.hash) {
                console.log(`🌟 Invalid hash at block ${i}: computed ${currentBlockHash}, expected ${currentBlock.hash}`);
                return false;
            }
            console.log(`🌟 FInished check`)
        }
        console.log("👍 Chain is valid");

        return true;
    }

    isLast10BlocksValid(last10Blocks) {
        console.log("🔍 Validating received last 10 blocks...");
        if(last10Blocks.length < NODE_SYNCING_FREQ) {
            return false;
        }

        for (let i = 1; i < NODE_SYNCING_FREQ; i++) {
            const currentBlock = Block.fromObject(last10Blocks[i]);
            const previousBlock = Block.fromObject(last10Blocks[i - 1]);
            
            if (currentBlock.previousHash !== previousBlock.hash) {
                console.log(`❌ Previous hash and current hash not matching for block ${i}`);
                return false;
            }

            // console.log(`🔗 Current block: ${JSON.stringify(currentBlock)}`);
            // console.log(`🔗 bid list in block ${currentBlock.bidHashList} , ${JSON.stringify(currentBlock.bidHashList)}`);
            const blockString = currentBlock.index + JSON.stringify(currentBlock.transactions) + currentBlock.previousHash + JSON.stringify(currentBlock.bidHashList);
            // console.log(`🌟 Validating block string for block ${i}`);
            const currentBlockHash = ChainUtil.createHash(blockString);
            if (currentBlockHash !== currentBlock.hash) {
                console.log(`🌟 Invalid hash at block ${i}: computed ${currentBlockHash}, expected ${currentBlock.hash}`);
                return false;
            } 
            // console.log(`🌟 FInished check`)
        }
        console.log("👍 Last 10 blocks are valid");

        return true;
    }

    async replaceChain(newChain, bidManager, totalPeers, publicKey, signature) {
        // console.log(`📊 Current state: receivedChains count: ${Object.keys(this.receivedChains).length}, receivedDifferentChains: ${Object.keys(this.receivedDifferentChains).length}, majorityReached: ${this.majorityReached}`);
        if (this.majorityReached) {
            return;
        }
        if (publicKey in this.blacklisted) {
            console.log(`🚫 Block proposer ${publicKey} is blacklisted. Rejecting block.`);
            return;
        }
        if (newChain.length <= this.chain.length) {
            console.log(`📛 Received chain is not longer than the current chain. Ignoring: ${newChain.length}`);
            return;
        }

        if (!this.isChainValid(newChain)) {
            console.log('📛 Received chain is invalid. Ignoring.');
            return;
        }

        if (this.receivedChainsWithSender[publicKey]) {
            console.log(`🗳️ Ignoring duplicate vote from ${publicKey}`);
            // TODO: could mark this as malicious behaviour
            return;
        }

        if (!ChainUtil.verifySignature(publicKey, signature, ChainUtil.createHash(JSON.stringify(newChain)))) {
            console.log(`🗳️ Ignoring invalid signature from ${publicKey}`);
            // TODO: could mark this as malicious behaviour
            return;
        }

        // ✅ Use only stable fields for hashing (ignore timestamps etc.)
        const simplifiedChain = newChain.map(block => ({
            index: block.index,
            transactions: block.transactions,
            proposerPublicKey: block.proposerPublicKey,
            bidHashList: block.bidHashList,
            hash: block.hash,
            previousHash: block.previousHash
        }));

        const hashKey = ChainUtil.createHash(JSON.stringify(simplifiedChain));
        this.receivedDifferentChains[hashKey] = newChain;
        console.log(`Received last 10 blocks: ${JSON.stringify(this.receivedChains)}`);

        this.receivedChainsWithSender[publicKey] = newChain;
        console.log(`✅ ${JSON.stringify(this.receivedChainsWithSender)}`);
        this.receivedChains[hashKey] = (this.receivedChains[hashKey] || 0) + 1;
        const majorityThreshold =  Math.floor((2 / 3) * totalPeers);
        const sortedData = Object.entries(this.receivedChains).sort((a, b) => b[1] - a[1]);
        const [mostFrequentData, count] = sortedData[0];

        if (!this.majorityReached && count >= majorityThreshold) {
            // this.majorityLast10Blocks = JSON.parse(mostFrequentData);
            this.majorityReached = true;
            console.log("✅ 2/3 majority reached. Replacing local chain....");
            
            const majorityChain = this.receivedDifferentChains[mostFrequentData];
            this.chain = majorityChain;
            await db.saveChain(this.chain);

            // Update bid manager round to match new chain
            if (bidManager) {
                const newRound = this.getLastBlock().index + 1;
                bidManager.handleRound(newRound);
                console.log(`🔄 Updated bid manager to round ${newRound}`);
            }
        } else {
            console.log(`❌Majority not reached: ${majorityThreshold}, count is ${count}`);
            console.log("📊 Current sorted chain frequencies:");
            for (const [hash, freq] of sortedData) {
                console.log(`   🔹 Hash: ${hash.substring(0, 16)}... | Count: ${freq}`);
            }
        }

        
        
        console.log(`✅ Chain replaced and blocks and saved to DB.`);
        
    }

    async replaceLast10Blocks(newLast10Blocks, bidManager, senderPublicKey, totalPeers, signature) {
        console.log("🔍 Total peers: ", totalPeers);
        console.log(`📊 Current state: receivedLast10Blocks count: ${Object.keys(this.receivedLast10Blocks).length}, receivedLast10BlocksWithSender count: ${Object.keys(this.receivedLast10BlocksWithSender).length}, majorityReached: ${this.majorityReached}, majorityLast10Blocks: ${this.majorityLast10Blocks}`);
        if (senderPublicKey in this.blacklisted) {
            console.log(`🚫 Block proposer ${senderPublicKey} is blacklisted. Rejecting block.`);
            return;
        }

        if (this.receivedLast10BlocksWithSender[senderPublicKey]) {
            console.log(`🗳️ Ignoring duplicate last 10 blocks from ${senderPublicKey}`);
            // TODO: could mark this as malicious behaviour
            return;
        }

        console.log("Trying to verify malicious data");

        if (!ChainUtil.verifySignature(senderPublicKey, signature, ChainUtil.createHash(JSON.stringify(newLast10Blocks)))) {
            console.log(`🗳️ Ignoring invalid signature from ${publicKey}`);
            // TODO: could mark this as malicious behaviour
            return;
        }

        // 2️⃣ Validate incoming data
        if (!Array.isArray(newLast10Blocks)) {
            console.log("⚠️ Invalid or insufficient last 10 blocks received.");
            return;
        }

        if (!this.isLast10BlocksValid(newLast10Blocks)) {
            console.log('📛 Received last 10 blocks are invalid. Ignoring.');
            return;
        }

        if (newLast10Blocks.length < NODE_SYNCING_FREQ) {
            console.log(`📛 Did not receive sufficient blocks.`);
            return;
        }

        // ✅ Use only stable fields for hash comparison
        const simplifiedBlocks = newLast10Blocks.map(block => ({
            index: block.index,
            transactions: block.transactions,
            proposerPublicKey: block.proposerPublicKey,
            bidHashList: block.bidHashList,
            hash: block.hash,
            previousHash: block.previousHash
        }));

        this.receivedLast10BlocksWithSender[senderPublicKey] = newLast10Blocks;
        const hashKey = ChainUtil.createHash(JSON.stringify(simplifiedBlocks));
        // const hashKey = JSON.stringify(newLast10Blocks);
        this.receivedLast10Blocks[hashKey] = (this.receivedLast10Blocks[hashKey] || 0) + 1;
        console.log(`\n🛑🛑🛑 Recorded last 10 blocks with hash key ${hashKey} at p2p-server`);
        const majorityThreshold =  Math.ceil((2 / 3) * totalPeers);
        const sortedData = Object.entries(this.receivedLast10Blocks).sort((a, b) => b[1] - a[1]);
        const [mostFrequentData, count] = sortedData[0];
        console.log(`Sorted data: ${JSON.stringify(sortedData)}`);

        if (!this.majorityReached && count >= majorityThreshold) {
            // this.majorityLast10Blocks = JSON.parse(mostFrequentData);
            this.majorityReached = true;
            console.log("\n✅ 2/3 majority reached. Comparing with the local last 10 blocks.");
            for (const [sender, blocks] of Object.entries(this.receivedLast10BlocksWithSender)) {
                const senderSimplified = blocks.map(b => ({
                    index: b.index,
                    transactions: b.transactions,
                    proposerPublicKey: b.proposerPublicKey,
                    bidHashList: b.bidHashList,
                    hash: b.hash,
                    previousHash: b.previousHash
                }));
                if (ChainUtil.createHash(JSON.stringify(senderSimplified)) === mostFrequentData) {
                    this.majorityLast10Blocks = blocks;
                    break;
                }
            }
            
            const local10Blocks = this.chain.slice(-NODE_SYNCING_FREQ);
            const localSimplified = local10Blocks.map(block => ({
                index: block.index,
                transactions: block.transactions,
                proposerPublicKey: block.proposerPublicKey,
                bidHashList: block.bidHashList,
                hash: block.hash,
                previousHash: block.previousHash
            }));
            const localHash = ChainUtil.createHash(JSON.stringify(localSimplified));
            if (localHash === mostFrequentData) {
                console.log("✅ Local last 10 blocks match the majority. No action needed.");
            } else {
                console.log("⚠️ Local last 10 blocks differ from majority. Replacing local last 10 blocks.");
                // Replace local last 10 blocks
               
                // Implement replacing the correct blocks. Or, everytime, replace the last 10 blocks by considering the indices.
                const majorityBlock = Block.fromObject(this.majorityLast10Blocks[0]);
                const majorityBlockIndex = majorityBlock.index;
                // Replace from this point onwards
                this.chain = this.chain.slice(0, majorityBlockIndex).concat(this.majorityLast10Blocks.map(blockData => Block.fromObject(blockData)));
                
                // this.chain.splice(-NODE_SYNCING_FREQ, NODE_SYNCING_FREQ, ...this.majorityLast10Blocks.map(blockData => Block.fromObject(blockData)));
                await db.saveChain(this.chain);
                console.log("✅ Local last 10 blocks replaced and saved to DB.");
            }
        } else {
            console.log("📊 Current sorted last 10 blocks frequencies:");
            for (const [hash, freq] of sortedData) {
                console.log(`   🔹 Hash: ${hash.substring(0, 16)}... | Count: ${freq}`);
            }
        }

        // console.log("REACHED HERE 1 ................");

        // See whether the total no.of received 10 blocks is equal to the total peers.
        console.log(`⏳Total received last 10 blocks from proposers: ${Object.keys(this.receivedLast10BlocksWithSender).length}, total peers (excluding blacklisted): ${totalPeers - this.blacklisted.size}`);
        if (Object.keys(this.receivedLast10BlocksWithSender).length < (totalPeers - this.blacklisted.size)) {
            console.log(`⏳ Waiting for more last 10 blocks to reach majority...`);
            return;
        }

        // console.log("REACHED HERE 2 ................");

        for (const [senderKey, blocks] of Object.entries(this.receivedLast10BlocksWithSender)) {
            const simplified = blocks.map(b => ({
                index: b.index,
                transactions: b.transactions,
                proposerPublicKey: b.proposerPublicKey,
                bidHashList: b.bidHashList,
                hash: b.hash,
                previousHash: b.previousHash
            }));
            const blockHash = ChainUtil.createHash(JSON.stringify(simplified));
            if (blockHash !== mostFrequentData) {
                console.log(`⚠️ Sender ${senderKey} provided minority last 10 blocks. Marking as malicious.`);
                this.maliciousCount[senderKey] = (this.maliciousCount[senderKey] || 0) + 1;

                // 🚫 Blacklist after 3 malicious acts
                if (this.maliciousCount[senderKey] >= 3) {
                    this.blacklisted.add(senderKey);
                    console.log(`🚫 Proposer ${senderKey} permanently blacklisted.`);
                }
                // 💾 Save updated malicious data
                await db.saveMaliciousNodes({
                    counts: this.maliciousCount,
                    blacklisted: Array.from(this.blacklisted)
                });
                console.log(`💾 Saved updated malicious data in db: counts: ${this.maliciousCount},
                    blacklisted: ${Array.from(this.blacklisted)}`);
            }
        }

        // console.log("REACHED HERE 3 ................");

        // Update bid manager round to match new chain
        if (bidManager) {
            const newRound = this.getLastBlock().index + 1;
            bidManager.handleRound(newRound);
            console.log(`🔄 Updated bid manager to round ${newRound}`);
        }
        
        console.log(`✅ Last 10 blocks syncing done.`);
        
    }

    async handleMaliciousData(newMaliciousData, totalPeers, publicKey, signature) {
        if (this.majorityReached) {
            return;
        }

        if (publicKey in this.blacklisted) {
            console.log(`🚫 Block proposer ${publicKey} is blacklisted. Rejecting block.`);
            return;
        }

        if (this.receivedMaliciousDatasWithSender[publicKey]) {
            console.log(`🗳️ Ignoring duplicate malicious data from ${publicKey}`);
            // TODO: could mark this as malicious behaviour
            return;
        }
        console.log("Trying to verify malicious data");
        console.log(`👍 malicious data trying to verify: ${JSON.stringify(newMaliciousData)}`);

        if (!ChainUtil.verifySignature(publicKey, signature, ChainUtil.createHash(JSON.stringify(newMaliciousData)))) {
            console.log(`🗳️ Ignoring invalid signature from ${publicKey}`);
            // TODO: could mark this as malicious behaviour
            return;
        }


        // Compute total votes in incoming data
        const incomingTotalCounts = Object.values(newMaliciousData.counts || {}).reduce((sum, v) => sum + v, 0);

        // Compute total votes in local maliciousCount
        const localTotalCounts = Object.values(this.maliciousCount || {}).reduce((sum, v) => sum + v, 0);

        // Proceed only if incoming data has more votes than local
        if (incomingTotalCounts <= localTotalCounts) {
            console.log(`⚠️ Incoming malicious data ignored (total votes: ${incomingTotalCounts} <= local votes: ${localTotalCounts})`);
            return;
        }

        const majorityThreshold =  Math.ceil((2 / 3) * totalPeers);
        const key = JSON.stringify(newMaliciousData);
        this.receivedMaliciousData[key] = (this.receivedMaliciousData[key] || 0) + 1;
        this.receivedMaliciousDatasWithSender[publicKey] = newMaliciousData;
        const sortedData = Object.entries(this.receivedMaliciousData).sort((a, b) => b[1] - a[1]);
        const [mostFrequentData, count] = sortedData[0];
        
        if (count >= majorityThreshold) {
            const finalMaliciousData = JSON.parse(mostFrequentData);

            this.majorityReached = true;
            this.receivedMaliciousData = {}; // Reset for future rounds
            this.maliciousCount = finalMaliciousData.counts || {};
            this.blacklisted = new Set(finalMaliciousData.blacklisted || []);
            await db.saveMaliciousNodes({
                counts: finalMaliciousData.counts,
                blacklisted: finalMaliciousData.blacklisted
            });
            console.log("✅ 2/3 majority reached. Saved malicious data to DB.");
        }
    }

    removeLastBlock() {
        if(this.chain.length > 1) {
            this.chain.pop();
        }
    }

}

module.exports = Blockchain;