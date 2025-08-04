const BidPacket = require("./bid-packet");
const ChainUtil = require("../chain-util");
const { ROUND_INTERVAL } = require("../config");
const { log } = require("console");
const Block = require("../blockchain/block");
const {
  bidHashTable,
  transformBidManagerToHashTable,
  createOptimizedBidArray,
  sortBidsOptimized,
  findClosestBidBinarySearch,
  findClosestBidPublicKey,
  performanceTest,
  generateLargeBidHashTable,

} = require("./consensus");

class BidManager {
  constructor(selfPublicKey) {
    this.selfPublicKey = selfPublicKey;
    this.bidList = new Map();
    this.round = 0;
  }

  generateBid(round, wallet) {
    const bidHash = ChainUtil.createHash(
      String(Math.floor(Math.random() * 100000))
    );
    const bidPacket = new BidPacket({
      publicKey: this.selfPublicKey,
      round,
      bidHash,
      wallet,
    });
    this.addToBidList(bidPacket);
    return bidPacket;
  }

  receiveBid(bidPacket) {
    if (!BidPacket.verifyBid(bidPacket)) return false;

    this.addToBidList(bidPacket);

    return true;
  }

  selectProposer(round, blockHash) {
    const roundBids = this.bidList.get(round);
    const closestBid = this.getClosestBid(blockHash, roundBids);
    return closestBid ? closestBid.publicKey : null;
  }

  getAllBids(round) {
    return this.bidList.get
    (round) || [];
  }

  clearRound(round) {
    this.bidList.delete(round);
  }

  hashToBigInt(hash) {
    return BigInt("0x" + hash);
  }

  getClosestBid(blockHash, bidPackets) {
    const blockInt = this.hashToBigInt(blockHash);
    let closestBid = null;
    let closestDistance = null;

    for (const bidPacket of bidPackets) {
      const bidInt = this.hashToBigInt(bidPacket.bidHash);
      const distance =
        blockInt > bidInt ? blockInt - bidInt : bidInt - blockInt;

      if (closestDistance === null || distance < closestDistance) {
        closestDistance = distance;
        closestBid = bidPacket;
      }
    }

    return closestBid;
  }

  addToBidList(bidPacket) {
    const round = bidPacket.round;
    if (!this.bidList.has(round)) {
      this.bidList.set(round, []);
    }

    const roundBids = this.bidList.get(round);

    if (!roundBids.some((b) => b.publicKey === bidPacket.publicKey)) {
      roundBids.push(bidPacket);
    }
  }

 
}

module.exports = BidManager;
