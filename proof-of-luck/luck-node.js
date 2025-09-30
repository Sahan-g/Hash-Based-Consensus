const Block = require("../blockchain/block");
const Luck = require("./luck");

class LuckNode {
  constructor(blockchain, wallet, p2pServer, transactionPool) {
    this.blockchain = blockchain;
    this.wallet = wallet;
    this.p2pServer = p2pServer;
    this.transactionPool = transactionPool;
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
    blockCandidate.luckProof = luckProof;

    const proposal = {
      block: blockCandidate,
      round: blockCandidate.index + 1,
    };

    return proposal;
  }

  createProposalWithLuck(round) {
    const lastBlock = this.blockchain.getLastBlock();

    const transactions = this.transactionPool.getTransactions();
    console.log("transactions : ", transactions);

    const blockCandidate = new Block({
      index: lastBlock.index + 1,
      transactions,
      previousHash: lastBlock.hash,
      proposerPublicKey: this.wallet.publicKey,
      wallet: this.wallet,
    });

    const luckProof = Luck.generateLuck(this.wallet, round);
    blockCandidate.luckProof = luckProof;

    const proposal = {
      block: blockCandidate,
      round,
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
