const ChainUtil = require("../chain-util");
const { getMerkleRoot } = require("../bid/transaction-sync");

class Block {
  constructor({
    index,
    timestamp,
    transactions,
    previousHash,
    proposerPublicKey,
    bidHashList,
    hash,
    signature,
    wallet,
    luckProof,
    merkleRoot,
  }) {
    this.index = index;
    this.timestamp = timestamp || Date.now();
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.proposerPublicKey = proposerPublicKey;
    this.bidHashList = bidHashList || [];
    this.merkleRoot = merkleRoot
      ? merkleRoot
      : getMerkleRoot(this.transactions);
    this.hash = hash ? hash : this.computeHash();
    this.signature = signature ? signature : wallet.sign(this.hash);
    this.luckProof = luckProof || null;
  }

  computeHash() {
    const blockString =
      this.index + JSON.stringify(this.transactions) + this.previousHash + JSON.stringify(this.bidHashList);
    // console.log(`🌟 Block string for hashing`);
    return ChainUtil.createHash(blockString);
  } // removed timestamp

  static genesis(wallet) {
    return new Block({
      index: 0,
      transactions: [],
      previousHash: "0",
      proposerPublicKey: "GENESIS",
      wallet: wallet,
    });
  }

  static verifyBlock(block) {
    const blockString =
      block.index + JSON.stringify(block.transactions) + block.previousHash + JSON.stringify(block.bidHashList);
      console.log(`🌟 Verifying block...`);
    if (block.hash !== ChainUtil.createHash(blockString)) {
      console.log("Invalid block hash");
      return false;
    }

    if (
      !ChainUtil.verifySignature(
        block.proposerPublicKey,
        block.signature,
        block.hash
      )
    ) {
      console.log("Invalid block signature");
      return false;
    }
    console.log("Block verified successfully");
    return true;
  }

  static isValidBlock(block, previousBlock) {
    if (block.index !== previousBlock.index + 1) {
      console.log(
        `Invalid block index: ${block.index} expected: ${
          previousBlock.index + 1
        }`
      );
      return false;
    }
    if (block.previousHash !== previousBlock.hash) {
      console.log(`Invalid previous hash: ${block} expected: ${previousBlock}`);
      return false;
    }
    if (block.timestamp <= previousBlock.timestamp) {
      console.log("Invalid timestamp");
      return false;
    }

    console.log("Block is valid");
    return true;
  }

  static fromObject(obj) {
    const {
      index,
      timestamp,
      transactions,
      previousHash,
      proposerPublicKey,
      bidHashList,
      hash,
      signature,
      luckProof,
    } = obj;
    return new this({
      index,
      timestamp,
      transactions,
      previousHash,
      proposerPublicKey,
      bidHashList,
      hash,
      signature,
      luckProof,
    });
  }
}

module.exports = Block;
