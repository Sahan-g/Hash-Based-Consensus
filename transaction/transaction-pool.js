const Transaction = require("./transaction");
const Block = require("../blockchain/block");

const {ROUND_INTERVAL, TRANSACTION_COLLECTION_DURATION} = require("../config");

class TransactionPool {
  constructor() {
    this.transactions = [];
  }

  updateOrAddTransaction(transaction) {
    const validatedAndVerified = this.validateAndVerifyTransactions(transaction);
    if (!validatedAndVerified) {
      console.error("❌ Transaction validation or verification failed. Transaction not added.");
      return;
    }
    let transactionWithId = this.transactions.find(
      (t) => t.id === transaction.id
    );
    if (transactionWithId) {
      this.transactions[this.transactions.indexOf(transactionWithId)] =
        transaction;
      console.log("🔄 Transaction updated in the pool.");
    } else {
      this.transactions.push(transaction);
      console.log("🆕 New transaction added to the pool.");
    }
  }

  getTransactions() {
    return this.transactions;
  }

  clear() {
    this.transactions = [];
  }

  existingTransaction(address) {
    return this.transactions.find(
      (transaction) => transaction.input.address === address
    );
  }

  validateAndVerifyTransactions(transaction) {
      if (!transaction.id || !transaction.sensor_id || !transaction.timestamp || !transaction.hash || !transaction.input || !transaction.input.address || !transaction.input.signature || !transaction.input.timestamp) {
        console.error(`Invalid transaction: missing fields`, transaction);
        return false;
      }

      if (transaction.reading === undefined || transaction.metadata === undefined) {
        console.error(`Invalid transaction: missing reading or metadata`, transaction);
        return false;
      }

      if (!Transaction.verifyTransaction(transaction)) {
        console.error(`Invalid signature from ${transaction.input.address}`);
        return false;
      }

      return true;
  }

  removeConfirmedTransactions(confirmedTransactions) {
    // console.log("✅ Confirmed Transactions", confirmedTransactions);

    if (!Array.isArray(confirmedTransactions)) {
      console.warn("⚠️ confirmedTransactions is not a valid array:", confirmedTransactions);
      return;
    }

    this.transactions = this.transactions.filter(
      (t) => !confirmedTransactions.find((ct) => ct.id === t.id)
    );
  }


  getTransactionsForRound(transactionPool,wallet,round) {
    const allTxns = transactionPool.transactions;
    // console.log("all tx:", this.transactions)
    const roundStart = Block.genesis(wallet).timestamp + round * ROUND_INTERVAL;
    const roundEndLimit = roundStart + TRANSACTION_COLLECTION_DURATION; // 8-minute mark

    // Filter and sort
    const filteredTxns = allTxns
      .filter(
        (txn) =>  txn.timestamp < roundEndLimit // lower limit removed because since we consider txns only upto  8 minutes some will be left for the next round
      )
      .sort((a, b) => a.timestamp - b.timestamp);
      console.log("filtered:",filteredTxns)
    return filteredTxns;
  }
}

module.exports = TransactionPool;
