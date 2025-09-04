const { INITIAL_BALANCE } = require("../config");
const Transaction = require("../transaction/transaction");
const ChainUtil = require("../chain-util");
const db = require("../database");

class Wallet {
  constructor() {
    this.keyPair = null;
    this.publicKey = null;
  }

  static async loadOrCreate() {
    const wallet = new Wallet();
    let privateKey = await db.getWalletKey();

    if (privateKey) {
      wallet.keyPair = ChainUtil.ec.keyFromPrivate(privateKey, "hex");
      console.log("Wallet loaded from saved key.");
    } else {
      wallet.keyPair = ChainUtil.genKeyPair();
      privateKey = wallet.keyPair.getPrivate("hex");

      await db.saveWalletKey(privateKey);
      console.log("New wallet created and key saved.");
    }

    wallet.publicKey = wallet.keyPair.getPublic().encode("hex");
    console.log(`Wallet public key: ${wallet.publicKey}`);
    return wallet;
  }

  toString() {
    return `Wallet -
            publicKey: ${this.publicKey.toString()}
            balance  : ${this.balance}`;
  }

  sign(dataHash) {
    return this.keyPair.sign(dataHash);
  }

  createTransactionsold(recipient, amount, transactionPool, blockchain) {
    this.balance = this.calculateBalance(blockchain);
    if (amount > this.balance) {
      console.error(`Amount: ${amount} exceeds balance`);
      return;
    }

    let transaction = transactionPool.existingTransaction(this.publicKey);
    if (transaction) {
      transaction.update(this, recipient, amount);
    } else {
      transaction = Transaction.newTransaction(this, recipient, amount);
      transactionPool.updateOrAddTransaction(transaction);
    }
    return transaction;
  }

  createTransaction(
    sensor_id,
    reading,
    transactionPool = null,
    metadata = null
  ) {
    if (!sensor_id) {
      throw new Error("sensor_id is required");
    }
    if (!reading || typeof reading !== "object") {
      throw new Error("reading must be a non-null object");
    }

    const tx = Transaction.fromSensorReading(this, {
      sensor_id,
      reading,
      metadata,
    });

    if (transactionPool) {
      transactionPool.updateOrAddTransaction(tx);
    }

    return tx;
  }

  static blockchainWallet() {
    const blockchainWallet = new this();
    blockchainWallet.keyPair = ChainUtil.genKeyPair();
    blockchainWallet.publicKey = blockchainWallet.keyPair
      .getPublic()
      .encode("hex");
    return blockchainWallet;
  }
}

module.exports = Wallet;
