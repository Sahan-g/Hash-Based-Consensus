const { INITIAL_BALANCE } = require("../config");
const Transaction = require("../transaction/transaction");
const ChainUtil = require("../chain-util");

class Wallet {
  constructor() {
    this.balance = INITIAL_BALANCE;
    this.keyPair = ChainUtil.genKeyPair();
    this.publicKey = this.keyPair.getPublic().encode("hex");
    console.log("Wallet created with public key: ", this.publicKey);
  }

  toString() {
    return `Wallet -
            publicKey: ${this.publicKey.toString()}
            balance  : ${this.balance}`;
  }

  sign(dataHash) {
    return this.keyPair.sign(dataHash);
  }

  createTransaction(recipient, amount, transactionPool, blockchain) {
    // console.log(
    //   "checking error: ",
    //   recipient,
    //   amount,
    //   transactionPool,
    //   blockchain
    // );
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

  calculateBalance(blockchain) {
    console.log(`Calculating balance for wallet: ${this.publicKey}`);
    console.log("The blockchain is : ", blockchain);
    let balance = this.balance;
    let transactions = [];
    blockchain.chain.forEach((block) =>
      block.transactions.forEach((transaction) => {
        transactions.push(transaction);
      })
    );

    const walletInputTs = transactions.filter(
      (transaction) => transaction.input.address === this.publicKey
    );
    let startTime = 0;
    if (walletInputTs.length > 0) {
      const recentInputT = walletInputTs.reduce((prev, current) => {
        return prev.timestamp > current.timestamp ? prev : current;
      });
      balance = recentInputT.outputs.find(
        (output) => output.address === this.publicKey
      ).amount;
      startTime = recentInputT.input.timestamp;
    }
    transactions.forEach((transaction) => {
      if (transaction.input.timestamp > startTime) {
        transaction.outputs.find((output) => {
          if (output.address === this.publicKey) {
            balance += output.amount;
          }
        });
      }
    });
    return balance;
  }

  static blockchainWallet() {
    const wallet = new Wallet();
    return wallet;
  }
}

module.exports = Wallet;
