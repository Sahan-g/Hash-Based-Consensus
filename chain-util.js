const EC = require("elliptic").ec;
const { v1: uuidV1 } = require("uuid");
const SHA256 = require("crypto-js/sha256");
const ec = new EC("secp256k1");
const crypto = require('crypto');

class ChainUtil {
  static genKeyPair() {
    return ec.genKeyPair();
  }

  static id() {
    return uuidV1();
  }

  // static hash(data) {
  //   return SHA256(JSON.stringify(data)).toString();
  // }

  static verifySignature(publicKey, signature, dataHash) {
    console.log(`Verifying signature for dataHash: ${dataHash} with publicKey: ${publicKey}`);
    const isVerified = ec.keyFromPublic(publicKey, "hex").verify(dataHash, signature);
    console.log(`Signature verified: ${isVerified}`);
    return isVerified;
  }

  static createHash(data) {
    console.log(`Creating hash for data: ${data}`);
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    console.log(`Generated hash: ${hash}`);
    return hash;
  }
}

ChainUtil.ec = ec;
module.exports = ChainUtil;
