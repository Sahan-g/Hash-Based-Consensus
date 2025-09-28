const Luck = require("./luck");

class LuckConsensus {
  constructor(blockchain, p2pServer) {
    this.blockchain = blockchain;
    this.p2pServer = p2pServer;
  }

  verifyAndEvaluateProposal(proposal) {
    if (!proposal || !proposal.block.luckProof || !proposal.block) {
      console.log("❌ Malformed proposal");
      return;
    }

    const { seed, round, publicKey, signature, luck } =
      proposal.block.luckProof;

    // if (this.p2pServer.wallet.publicKey === publicKey) {
    //   console.log("✅ Own proposal, auto-accepted");
    //   return;
    // }

    const res = Luck.verifyLuck(seed, round, publicKey, signature);
    if (!res || !res.valid) {
      console.log("❌ Invalid luck proof signature");
      return;
    }
    const incomingLuck = res.luck;

    if (luck !== incomingLuck) {
      console.log("❌ Luck value mismatch");
      return;
    }

    const lastBlock = this.blockchain.getLastBlock();

    if (round === lastBlock.index + 1) {
      this.blockchain.addBlockToChain(proposal.block);
      console.log("✅ New block added to the chain");
      return;
    } else if (round === lastBlock.index) {
      if (lastBlock.luckProof.luck < incomingLuck) {
        this.blockchain.removeLastBlock();
        this.blockchain.addBlockToChain(proposal.block);
        console.log("🔄 Replaced block with higher luck proposal");
        return;
      }
    } else {
      console.log("❌ Outdated proposal round");
      return;
    }
  }
}

module.exports = LuckConsensus;
