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
    blockCandidate.luckProof = luckProof;

    const proposal = {
      block: blockCandidate,
      round: blockCandidate.index + 1,
    };

    return proposal;
  }

  createProposalWithLuck(round) {
    const lastBlock = this.blockchain.getLastBlock();

    const transactions = [
      {
        id: "tx1",
        timestamp: 1695812331234,
        sensor_id: "sensor-A1",
        reading: { temperature: 26.4, humidity: 58 },
        metadata: { location: "Colombo", unit: "Celsius" },
        hash: "a2f31bc...",
        input: {
          timestamp: 1695812331234,
          address: "04ab23f...publicKey",
          signature: "3045022100ff...",
        },
      },
      {
        id: "tx2",
        timestamp: 1695812398888,
        sensor_id: "sensor-B2",
        reading: { soilMoisture: 33 },
        metadata: null,
        hash: "c73b92e...",
        input: {
          timestamp: 1695812398888,
          address: "04cd98e...publicKey",
          signature: "3045022100aa...",
        },
      },
    ];

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
