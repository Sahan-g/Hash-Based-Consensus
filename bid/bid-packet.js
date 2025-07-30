const crypto = require('crypto');
const ChainUtil = require('../chain-util');

class BidPacket {
  constructor({publicKey, round, bidHash, timestamp = Date.now(), wallet}) {
    this.publicKey = publicKey;
    this.round = round;
    this.bidHash = bidHash;
    this.timestamp = timestamp;

    const data = `${this.publicKey}-${this.round}-${this.bidHash}-${this.timestamp}`;
    const dataHash = ChainUtil.createHash(data);
    this.signature = wallet.sign(dataHash);
  }

  static verifyBid(bidPacket) {
    const {publicKey, round, bidHash, timestamp, signature} = bidPacket;
    const signedString = `${publicKey}-${round}-${bidHash}-${timestamp}`;
    return ChainUtil.verifySignature(publicKey, signature, ChainUtil.createHash(signedString));
  }

}

module.exports = BidPacket;