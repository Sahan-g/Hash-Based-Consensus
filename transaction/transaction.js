const ChainUtil = require("../chain-util");
const { PROPOSER_REWARD } = require("../config");

class Transaction {
  constructor(sensor_id, reading, metadata = null) {
    this.id = ChainUtil.id();
    this.timestamp = Date.now();

    this.sensor_id = sensor_id;
    this.reading = reading;
    this.metadata = metadata;

    // Signature envelope set by signTransaction()
    this.hash = null;
    this.input = null;
  }

  _signablePayload() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      sensor_id: this.sensor_id,
      reading: this.reading,
      metadata: this.metadata,
    };
  }

  static fromSensorReading(senderWallet, { sensor_id, reading, metadata }) {
    const tx = new this(sensor_id, reading, metadata);
    console.log(tx)
    return this.signTransaction(tx, senderWallet);
  }

  // static transactionWithOutputs(senderWallet, outputs) {
  //   const transaction = new this();
  //   transaction.outputs.push(...outputs);
  //   Transaction.signTransaction(transaction, senderWallet);
  //   return transaction;
  // }
  static signTransaction(transaction, senderWallet) {
    const payload = transaction._signablePayload();
    transaction.input = {
      timestamp: Date.now(),
      address: senderWallet.publicKey,
      signature: senderWallet.sign(ChainUtil.createHash(payload)),
    };
    return transaction;
  }

  static verifyTransaction(transaction) {
    const expectedHash = ChainUtil.createHash({
      id: transaction.id,
      timestamp: transaction.timestamp,
      sensor_id: transaction.sensor_id,
      reading: transaction.reading,
      metadata: transaction.metadata,
    });
    console.log(expectedHash)
    console.log(transaction.hash)
    if (expectedHash !== transaction.hash) return false;

    return ChainUtil.verifySignature(
      transaction.input.address,
      transaction.input.signature,
      transaction.hash
    );
  }

  // static signTransaction(transaction, senderWallet) {
  //   transaction.input = {
  //     timestamp: Date.now(),
  //     amount: senderWallet.balance,
  //     address: senderWallet.publicKey,
  //     // signature: senderWallet.sign(ChainUtil.hash(transaction.outputs)),
  //     signature: senderWallet.sign(
  //       ChainUtil.createHash(JSON.stringify(transaction.outputs))
  //     ),
  //   };
  //   return transaction;
  // }

  // static newTransaction(senderWallet, recipient, amount) {
  //   if (amount > senderWallet.balance) {
  //     console.error(`Amount: ${amount} exceeds balance`);
  //     return;
  //   }

  //   console.log("hit");
  //   return Transaction.transactionWithOutputs(senderWallet, [
  //     {
  //       amount: senderWallet.balance - amount,
  //       address: senderWallet.publicKey,
  //     },
  //     {
  //       amount,
  //       address: recipient,
  //     },
  //   ]);
  // }

  // static rewardTransaction(minerWallet, blockchainWallet) {
  //   return Transaction.transactionWithOutputs(blockchainWallet, [
  //     {
  //       amount: PROPOSER_REWARD,
  //       address: minerWallet.publicKey,
  //     },
  //   ]);
  // }

  // update(senderWallet, recipient, amount) {
  //   const senderOutput = this.outputs.find(
  //     (output) => output.address === senderWallet.publicKey
  //   );
  //   if (amount > senderOutput.amount) {
  //     console.error(`Amount: ${amount} exceeds balance`);
  //     return;
  //   }
  //   senderOutput.amount -= amount;
  //   this.outputs.push({
  //     amount,
  //     address: recipient,
  //   });
  //   Transaction.signTransaction(this, senderWallet);
  //   return this;
  // }

  // static verifyTransaction(transaction) {
  //   return ChainUtil.verifySignature(
  //     transaction.input.address,
  //     transaction.input.signature,
  //     // ChainUtil.hash(transaction.outputs)
  //     ChainUtil.createHash(JSON.stringify(transaction.outputs))
  //   );
  // }
}

module.exports = Transaction;
