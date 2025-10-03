const crypto = require("crypto");

/**
 * Utility function to create SHA256 hash
 * @param {string} data - Data to hash
 * @returns {string} - Hex encoded hash
 */
function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Simple Merkle tree implementation for transaction synchronization
 * @param {Array} leaves - Array of leaf hashes
 * @returns {string} - Root hash
 */
function buildMerkleTree(leaves) {
  if (leaves.length === 0) {
    return sha256("empty");
  }

  if (leaves.length === 1) {
    return leaves[0];
  }

  const nextLevel = [];

  // Process pairs of hashes
  for (let i = 0; i < leaves.length; i += 2) {
    const left = leaves[i];
    const right = leaves[i + 1] || leaves[i]; // Duplicate last hash if odd number

    const combined = left + right;
    const hash = sha256(combined);
    nextLevel.push(hash);
  }

  // Recursively build the tree
  return buildMerkleTree(nextLevel);
}

/**
 * Creates a Merkle Root from an array of transactions
 * @param {Array} transactions - Array of transaction objects
 * @returns {string} - Merkle Root as hex string
 */
function getMerkleRoot(transactions) {
  if (!transactions || transactions.length === 0) {
    return sha256("empty"); // Consistent hash for empty transaction set
  }

  // Create leaves by hashing each transaction (sorted for consistency)
  const leaves = transactions
    .map((tx) => JSON.stringify(tx))
    .sort() // Ensure consistent ordering
    .map((txString) => sha256(txString));

  // Build Merkle tree and return root
  return buildMerkleTree(leaves);
}

/**
 * Simulates a network node with transaction pool and synchronization capabilities
 */
class Node {
  constructor(id, transactionPool = []) {
    this.id = id;
    this.transactionPool = [...transactionPool]; // Create copy to avoid reference issues
    this.peerRoots = new Map(); // Store roots received from peers
    this.majorityRoot = null;
    this.isSynced = false;
  }

  /**
   * Calculate local Merkle Root
   * @returns {string} - Local Merkle Root
   */
  getLocalMerkleRoot() {
    return getMerkleRoot(this.transactionPool);
  }

  /**
   * Simulate receiving a Merkle Root from a peer
   * @param {string} root - Merkle Root from peer
   */
  receivePeerRoot(root) {
    const count = (this.peerRoots.get(root) || 0) + 1;
    this.peerRoots.set(root, count);
  }

  /**
   * Determine the majority root from all received peer roots
   * @returns {string} - Majority root
   */
  findMajorityRoot() {
    if (this.peerRoots.size === 0) return null;

    let maxCount = 0;
    let majorityRoot = null;

    for (const [root, count] of this.peerRoots.entries()) {
      if (count > maxCount) {
        maxCount = count;
        majorityRoot = root;
      }
    }

    this.majorityRoot = majorityRoot;
    return majorityRoot;
  }

  /**
   * Check if node is synchronized with the network
   * @returns {boolean} - True if synchronized
   */
  checkSynchronization() {
    const localRoot = this.getLocalMerkleRoot();
    this.isSynced = localRoot === this.majorityRoot;
    return this.isSynced;
  }

  /**
   * Find missing transactions by comparing with a peer's transaction pool
   * @param {Array} peerTransactionPool - Peer's transaction pool
   * @returns {Array} - Array of missing transactions
   */
  findMissingTransactions(peerTransactionPool) {
    const localTxIds = new Set(this.transactionPool.map((tx) => tx.id));
    return peerTransactionPool.filter((tx) => !localTxIds.has(tx.id));
  }

  /**
   * Add missing transactions to local pool
   * @param {Array} missingTransactions - Transactions to add
   */
  addMissingTransactions(missingTransactions) {
    this.transactionPool.push(...missingTransactions);
  }

  /**
   * Reset synchronization state for new round
   */
  resetSyncState() {
    this.peerRoots.clear();
    this.majorityRoot = null;
    this.isSynced = false;
  }
}

/**
 * Main simulation function that orchestrates the transaction synchronization process
 * @returns {Object} - Simulation results
 */
function runSynchronizationSimulation() {
  console.log("=== Starting Transaction Synchronization Simulation ===\n");

  // Define transaction sets
  const correctTransactions = [
    { id: "tx1", amount: 100, from: "Alice", to: "Bob" },
    { id: "tx2", amount: 50, from: "Bob", to: "Charlie" },
    { id: "tx3", amount: 75, from: "Charlie", to: "Alice" },
  ];

  const divergentTransactions = [
    { id: "tx1", amount: 100, from: "Alice", to: "Bob" },
    { id: "tx2", amount: 50, from: "Bob", to: "Charlie" },
    // Missing tx3
  ];

  // Create network of 5 nodes (4 correct, 1 divergent)
  const nodes = [];
  for (let i = 1; i <= 5; i++) {
    const isDivergent = i === 3; // Node 3 is divergent
    const transactions = isDivergent
      ? divergentTransactions
      : correctTransactions;
    nodes.push(new Node(`Node-${i}`, transactions));
  }

  console.log("Network created with 5 nodes:");
  nodes.forEach((node) => {
    console.log(`- ${node.id}: ${node.transactionPool.length} transactions`);
  });
  console.log("");

  // Phase 1: Commitment - Each node calculates its Merkle Root
  console.log("Phase 1: Commitment - Nodes calculate local Merkle Roots");
  const localRoots = new Map();
  nodes.forEach((node) => {
    const root = node.getLocalMerkleRoot();
    localRoots.set(node.id, root);
    console.log(`${node.id}: ${root.substring(0, 12)}...`);
  });
  console.log("");

  // Phase 2: Broadcast - Simulate nodes sharing their roots
  console.log("Phase 2: Broadcasting Merkle Roots to peers");
  nodes.forEach((node) => {
    // Simulate receiving roots from all other nodes
    nodes.forEach((peer) => {
      if (peer.id !== node.id) {
        const peerRoot = localRoots.get(peer.id);
        node.receivePeerRoot(peerRoot);
      }
    });

    // Add own root to the tally
    node.receivePeerRoot(localRoots.get(node.id));
  });
  console.log("Root exchange completed\n");

  // Phase 3: Discrepancy Resolution
  console.log("Phase 3: Discrepancy Resolution");
  const syncResults = {};

  nodes.forEach((node) => {
    const majorityRoot = node.findMajorityRoot();
    const isSynced = node.checkSynchronization();

    syncResults[node.id] = {
      localRoot: localRoots.get(node.id),
      majorityRoot: majorityRoot,
      isSynced: isSynced,
    };

    console.log(`${node.id}:`);
    console.log(`  Local Root: ${localRoots.get(node.id).substring(0, 12)}...`);
    console.log(`  Majority Root: ${majorityRoot.substring(0, 12)}...`);
    console.log(`  Status: ${isSynced ? "SYNCHRONIZED" : "OUT OF SYNC"}`);
  });
  console.log("");

  // Phase 4: Synchronization of divergent node
  const divergentNode = nodes[2]; // Node-3
  if (!divergentNode.isSynced) {
    console.log("Phase 4: Synchronizing divergent node");
    console.log(
      `${divergentNode.id} is out of sync. Initiating synchronization...`
    );

    // Find a synchronized peer to sync with
    const syncedPeer = nodes.find(
      (node) => node.id !== divergentNode.id && node.isSynced
    );

    if (syncedPeer) {
      console.log(`Requesting transaction list from ${syncedPeer.id}`);

      // Find missing transactions
      const missingTxs = divergentNode.findMissingTransactions(
        syncedPeer.transactionPool
      );
      console.log(
        `Found ${missingTxs.length} missing transactions:`,
        missingTxs.map((tx) => tx.id)
      );

      // Add missing transactions
      divergentNode.addMissingTransactions(missingTxs);
      console.log(`Added missing transactions to ${divergentNode.id}`);

      // Verify synchronization
      const newRoot = divergentNode.getLocalMerkleRoot();
      const isNowSynced = newRoot === divergentNode.majorityRoot;

      console.log(
        `${divergentNode.id} new root: ${newRoot.substring(0, 12)}...`
      );
      console.log(`Synchronization ${isNowSynced ? "SUCCESSFUL" : "FAILED"}`);

      syncResults[divergentNode.id].newRoot = newRoot;
      syncResults[divergentNode.id].finalSyncStatus = isNowSynced;
    }
  }

  console.log("\n=== Simulation Complete ===");
  return {
    nodes: nodes,
    syncResults: syncResults,
    correctRoot: getMerkleRoot(correctTransactions),
    divergentRoot: getMerkleRoot(divergentTransactions),
  };
}

module.exports = {
  getMerkleRoot,
  Node,
  runSynchronizationSimulation,
};
