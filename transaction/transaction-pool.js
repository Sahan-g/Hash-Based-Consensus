const Transaction = require("./transaction");
const App = require("../app/index");

const {TRANSACTION_COLLECTION_DURATION} = require("../config");

class TransactionPool {
  constructor() {
    this.transactions = [];
  }

  updateOrAddTransaction(transaction) {
    let transactionWithId = this.transactions.find(
      (t) => t.id === transaction.id
    );
    if (transactionWithId) {
      this.transactions[this.transactions.indexOf(transactionWithId)] =
        transaction;
    } else {
      this.transactions.push(transaction);
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

  validTransactions() {
    return this.transactions.filter((transaction) => {
      const outputTotal = transaction.outputs.reduce((total, output) => {
        return total + output.amount;
      }, 0);

      if (transaction.input.amount !== outputTotal) {
        console.error(
          `Invalid transaction from ${transaction.input.address}. Output total ${outputTotal} does not match input amount ${transaction.input.amount}`
        );
        return;
      }

      if (!Transaction.verifyTransaction(transaction)) {
        console.error(`Invalid signature from ${transaction.input.address}`);
        return;
      }

      return transaction;
    });
  }

removeConfirmedTransactions(confirmedTransactions) {
  console.log(confirmedTransactions);

  if (!Array.isArray(confirmedTransactions)) {
    console.warn("⚠️ confirmedTransactions is not a valid array:", confirmedTransactions);
    return;
  }

  this.transactions = this.transactions.filter(
    (t) => !confirmedTransactions.find((ct) => ct.id === t.id)
  );
}


   getTransactionsForRound(transactionPool) {
    console.log(transactionPool)
    const allTxns = transactionPool.transactions;
    
    const roundStart = App.round_start;
    const roundEndLimit = roundStart + TRANSACTION_COLLECTION_DURATION; // 8-minute mark

    // Filter and sort
    const filteredTxns = allTxns
      .filter(
        (txn) =>  txn.timestamp < roundEndLimit // lower limit removed because since we consider txns only upto  8 minutes some will be left for the next round
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    return filteredTxns;
  }
}

module.exports = TransactionPool;
