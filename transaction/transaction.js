const ChainUtil = require("../chain-util");
const { MINING_REWARD } = require("../config");

class Transaction {
  constructor() {
    this.id = ChainUtil.id();
    this.input = null;
    this.outputs = [];
  }

  static transactionWithOutputs(senderWallet, outputs) {
    const transaction = new this();
    transaction.outputs.push(...outputs);
    Transaction.signTransaction(transaction, senderWallet);
    return transaction;
  }

  static signTransaction(transaction, senderWallet) {
    transaction.input = {
      timestamp: Date.now(),
      amount: senderWallet.balance,
      address: senderWallet.publicKey,
      // signature: senderWallet.sign(ChainUtil.hash(transaction.outputs)),
      signature: senderWallet.sign(ChainUtil.createHash(JSON.stringify(transaction.outputs))),
    };
    return transaction;
  }

  static newTransaction(senderWallet, recipient, amount) {
    if (amount > senderWallet.balance) {
      console.error(`Amount: ${amount} exceeds balance`);
      return;
    }

    console.log("hit");
    return Transaction.transactionWithOutputs(senderWallet, [
      {
        amount: senderWallet.balance - amount,
        address: senderWallet.publicKey,
      },
      {
        amount,
        address: recipient,
      },
    ]);
  }

  static rewardTransaction(minerWallet, blockchainWallet) {
    return Transaction.transactionWithOutputs(blockchainWallet, [
      {
        amount: MINING_REWARD,
        address: minerWallet.publicKey,
      },
    ]);
  }

  update(senderWallet, recipient, amount) {
    const senderOutput = this.outputs.find(
      (output) => output.address === senderWallet.publicKey
    );
    if (amount > senderOutput.amount) {
      console.error(`Amount: ${amount} exceeds balance`);
      return;
    }
    senderOutput.amount -= amount;
    this.outputs.push({
      amount,
      address: recipient,
    });
    Transaction.signTransaction(this, senderWallet);
    return this;
  }

  static verifyTransaction(transaction) {
    return ChainUtil.verifySignature(
      transaction.input.address,
      transaction.input.signature,
      // ChainUtil.hash(transaction.outputs)
      ChainUtil.createHash(JSON.stringify(transaction.outputs))
    );
  }
}

module.exports = Transaction;
