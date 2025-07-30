const crypto = require('crypto');

class BidPacket {
  constructor({publicKey, round, bidHash, timestamp = Date.now()}) {
    this.publicKey = publicKey;
    this.round = round;
    this.bidHash = bidHash;
    this.timestamp = timestamp;
    this.signature = this.signBid();
  }

  signBid() {
    const data = `${this.publicKey}-${this.round}-${this.bidHash}-${this.timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static verifyBid(bidPacket){
    const {publicKey, round, bidHash, timestamp, signature} = bidPacket;
    const expectedSignature = crypto.createHash('sha256').update(`${publicKey}-${round}-${bidHash}-${timestamp}`).digest('hex');
    return expectedSignature === signature;
  }

}

module.exports = BidPacket;

// TODO: Sign bid using private key
// TODO: Verify bid using public key