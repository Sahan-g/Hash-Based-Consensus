const Transaction = require("./transaction");

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
    this.transactions = this.transactions.filter(
      (t) => !confirmedTransactions.find((ct) => ct.id === t.id)
    );
  }

   getTransactionsForRound(transactionPool) {
    const allTxns = transactionPool.transactions;

    const roundStart = Block.genesis().timestamp + this.round * ROUND_INTERVAL;
    const roundEndLimit = roundStart + 8 * 60 * 1000; // 8-minute mark

    // Filter and sort
    const filteredTxns = allTxns
      .filter(
        (txn) => txn.timestamp >= roundStart && txn.timestamp < roundEndLimit
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    return filteredTxns;
  }
}

module.exports = TransactionPool;
