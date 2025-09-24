const Block = require("../blockchain/block");
const Luck = require("./luck");

class LuckNode {
  constructor(blockchain, wallet, p2pServer) {
    this.blockchain = blockchain;
    this.wallet = wallet;
    this.p2pServer = p2pServer;
  }

  createProposal(transactions) {
    const lastBlock = this.blockchain.getLastBlock();

    const blockCandidate = new Block({
      index: lastBlock.index + 1,
      transactions,
      previousHash: lastBlock.hash,
      proposerPublicKey: this.wallet.publicKey,
      wallet: this.wallet,
    });

    const luckProof = Luck.generateLuck(this.wallet, blockCandidate.index + 1);

    const proposal = {
      block: blockCandidate,
      luckProof,
      proposer: this.wallet.publicKey,
      round: blockCandidate.index + 1,
      timestamp: Date.now(),
    };

    return proposal;
  }

  verifyProposal(proposal) {
    const { block, luckProof } = proposal;
    const blockValid = Block.verifyBlock(block);
    const luckValid = Luck.verifyLuck(luckProof);
    return blockValid && luckValid;
  }
}

module.exports = LuckNode;
