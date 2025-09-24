const Luck = require("./luck");

class LuckConsensus {
    constructor(blockchain, p2pServer) {
        this.blockchain = blockchain;
        this.p2pServer = p2pServer;
    }

    verifyAndEvaluateProposal(proposal) {
        if (!proposal || !proposal.luckProof || !proposal.block) {
            return {
                accepted: false,
                reason: "Malformed proposal",
            };
        }

        const {seed, round, publicKey, signature, luck} = proposal.luckProof;

        if (this.p2pServer.wallet.publicKey === publicKey) {
            return {
                accepted: true,
                reason: "Own proposal, auto-accepted",
            };
        }

        const res = Luck.verifyLuck(seed, round, publicKey, signature);
        if (!res || !res.valid) {
            return {
                accepted: false,
                reason: "Invalid luck proof signature",
            };
        }

        const incomingLuck = res.luck;

        if (luck !== incomingLuck) {
            return {
                accepted: false,
                reason: "Luck value mismatch",
            };
        }

        const lastBlock = this.blockchain.getLastBlock();

        if (round === lastBlock.index + 1) {
            this.blockchain.addBlockToChain(proposal.block);
            return { 
                accepted: true, 
                reason: 'no existing block for round', 
                luck: incomingLuck 
            };
        } else if (round === lastBlock.index) {
            if (lastBlock.luckProof.luck < incomingLuck) {
                this.blockchain.removeLastBlock();
                this.blockchain.addBlockToChain(proposal.block);
                return { 
                    accepted: true, 
                    reason: 'Replaced existing block with higher luck', 
                    luck: incomingLuck 
                };
            }
        } else {
            return {
                accepted: false,
                reason: "Proposal round is outdated",
            };
        }
    }
}

module.exports = LuckConsensus;
