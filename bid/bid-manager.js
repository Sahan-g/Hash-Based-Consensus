const BidPacket = require("./bid-packet");
const ChainUtil = require("../chain-util");
const { ROUND_INTERVAL, STRICT_ROUND_VALIDATION } = require("../config");
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
const { threadId } = require("worker_threads");

class BidManager {
  constructor(selfPublicKey, blockchain) {
    this.selfPublicKey = selfPublicKey;
    this.bidList = new Map();
    // Initialize round based on time for strict synchronization
    this.round = Math.floor(Date.now() / ROUND_INTERVAL);
    this.blockchain = blockchain;
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
    // console.log(`🛑 Created bidPacket: ${JSON.stringify(bidPacket)}`);
    return bidPacket;
  }

  receiveBid(bidPacket) {
    if (!BidPacket.verifyBid(bidPacket)) return false;

    // STRICT TIME-BASED SYNCHRONIZATION: Only accept bids for current round
    if (STRICT_ROUND_VALIDATION && bidPacket.round !== this.round) {
      console.log(`⏭️ Bid from round ${bidPacket.round} rejected - current round is ${this.round} (strict mode)`);
      return false;
    }

    // Check whether the bid hash is from a blacklisted node
    if (this.blockchain.blacklisted.has(bidPacket.publicKey)) {
      console.log(`⛔⛔⛔ Bid from blacklisted node ${bidPacket.publicKey} rejected`);
      return false;
    }

    this.addToBidList(bidPacket);

    return true;
  }

  handleRound(round) {
    // In strict time-based mode, don't update round from peers
    // Round is calculated from time only
    if (!STRICT_ROUND_VALIDATION && this.round < round) {
      this.round = round;
      console.log(`🔄 Updated to new round: ${this.round}`);
    } else if (STRICT_ROUND_VALIDATION) {
      console.log(`⏰ Ignoring round update in strict time-based mode (current: ${this.round})`);
    }
  }

  selectProposer(round, blockHash) {
    const roundBids = this.bidList.get(round);
    const closestBid = this.getClosestBid(blockHash, roundBids);
    return closestBid ? closestBid.publicKey : null;
  } // 

  getAllBids(round) {
    return this.bidList || [];
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
    // if (bidPacket.publicKey in this.blockchain.blacklisted) {
    //   console.log(`⛔⛔⛔ Bid from blacklisted node ${bidPacket.publicKey} rejected`);
    //   return false;
    // }
    const round = bidPacket.round;
    if (!this.bidList.has(round)) {
      this.bidList.set(round, []);
    }

    const roundBids = this.bidList.get(round);

    if (!roundBids.some((b) => b.publicKey === bidPacket.publicKey)) {
      roundBids.push(bidPacket);
      console.log(`✅ Bid added for round ${round} from ${bidPacket.publicKey} at ${Date.now()}`);
      // console.log(`Current bids for round ${round}: ${JSON.stringify(this.bidList.get(round))}`);
    }
  }

 
}

module.exports = BidManager;
