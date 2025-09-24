const ChainUtil = require("../chain-util");

class Luck {
  static generateLuck(wallet, round) {
    const seed = Math.random().toString(36).substring(2, 12);
    const hash = ChainUtil.createHash(`${wallet.publicKey}-${round}-${seed}`);
    const luck = parseInt(hash.substring(0, 16), 16) / 0xffffffffffffffff;

    const signature = wallet.sign(ChainUtil.createHash(seed));

    return {
      luck,
      seed,
      round,
      publicKey: wallet.publicKey,
      signature,
    };
  }

  static verifyLuck(seed, round, publicKey, signature) {
    const isValid = ChainUtil.verifySignature(
      publicKey,
      signature,
      ChainUtil.createHash(seed)
    );
    if (!isValid) return false;

    const hash = ChainUtil.createHash(`${publicKey}-${round}-${seed}`);
    const luck = parseInt(hash.substring(0, 16), 16) / 0xffffffffffffffff;

    return { valid: isValid, luck };
  }
}

module.exports = Luck;
