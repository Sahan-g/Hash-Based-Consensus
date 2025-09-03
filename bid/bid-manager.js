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
  constructor(selfPublicKey, blockchain) {
    this.selfPublicKey = selfPublicKey;
    this.bidList = new Map();
    this.round = blockchain.getLastBlock().index + 1;
    console.log(`BidManager initialized for round ${this.round}`);
    this.phase1EndTime = null;
  }

  startPhase1() {
    this.phase1EndTime = Date.now() + ROUND_INTERVAL;
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
    console.log(`📝 Bid generated for round ${bidPacket.round} : ${bidHash}`);
    return bidPacket;
  }

  receiveBid(bidPacket) {
    if(Date.now() > this.phase1EndTime) {
      console.log(`⛔ Bidding is closed, cannot add bid from ${bidPacket.publicKey}.`);
      return false;
    }

    if (!BidPacket.verifyBid(bidPacket)) return false;

    this.addToBidList(bidPacket);

    return true;
  }

  handleRound(round) {
    if(this.round < round) {
      this.round = round;
      console.log(`🔄 Updated to new round: ${this.round}`);
    }
  }

  selectProposer(round, blockHash) {
    const roundBids = this.bidList.get(round);
    const closestBid = this.getClosestBid(blockHash, roundBids);
    return closestBid ? closestBid.publicKey : null;
  } // 

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
      console.log(`✅ Bid added for round ${round} from ${bidPacket.publicKey} at ${new Date().toISOString()}`);
      console.log(`Current bids for round ${round}: ${JSON.stringify(this.bidList.get(round))}`);
    }
  }

 
}

module.exports = BidManager;
