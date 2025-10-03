const {
  getMerkleRoot,
  Node,
  runSynchronizationSimulation,
} = require("./transaction-sync");

// Simple test framework
function describe(name, fn) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`${name.toUpperCase()}`);
  console.log(`${"=".repeat(60)}`);
  fn();
}

function it(name, fn) {
  console.log(`\n--- ${name} ---`);
  try {
    fn();
    console.log("✅ PASSED");
  } catch (error) {
    console.log("❌ FAILED:", error.message);
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
      }
    },
    not: {
      toBe: (expected) => {
        if (actual === expected) {
          throw new Error(`Expected ${actual} not to equal ${expected}`);
        }
      },
    },
    toHaveLength: (expected) => {
      if (actual.length !== expected) {
        throw new Error(
          `Expected length ${expected}, but got ${actual.length}`
        );
      }
    },
    toBeDefined: () => {
      if (actual === undefined || actual === null) {
        throw new Error(`Expected value to be defined, but got ${actual}`);
      }
    },
    toBeLessThan: (expected) => {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
  };
}

// Tests
describe("Transaction Synchronization Proof-of-Concept", () => {
  describe("Merkle Root Utility Tests", () => {
    it("should produce identical roots for identical transaction sets", () => {
      const transactions1 = [
        { id: "tx1", amount: 100 },
        { id: "tx2", amount: 200 },
      ];

      const transactions2 = [
        { id: "tx1", amount: 100 },
        { id: "tx2", amount: 200 },
      ];

      const root1 = getMerkleRoot(transactions1);
      const root2 = getMerkleRoot(transactions2);

      console.log("Testing identical transaction sets:");
      console.log(`Root 1: ${root1}`);
      console.log(`Root 2: ${root2}`);
      console.log(`Roots match: ${root1 === root2}\n`);

      expect(root1).toBe(root2);
    });

    it("should produce different roots for different transaction sets", () => {
      const transactions1 = [
        { id: "tx1", amount: 100 },
        { id: "tx2", amount: 200 },
      ];

      const transactions2 = [
        { id: "tx1", amount: 100 },
        { id: "tx2", amount: 200 },
        { id: "tx3", amount: 300 },
      ];

      const root1 = getMerkleRoot(transactions1);
      const root2 = getMerkleRoot(transactions2);

      console.log("Testing different transaction sets:");
      console.log(`Root 1 (2 txs): ${root1.substring(0, 16)}...`);
      console.log(`Root 2 (3 txs): ${root2.substring(0, 16)}...`);
      console.log(`Roots different: ${root1 !== root2}\n`);

      expect(root1).not.toBe(root2);
    });

    it("should handle empty transaction pools consistently", () => {
      const emptyRoot1 = getMerkleRoot([]);
      const emptyRoot2 = getMerkleRoot(null);
      const emptyRoot3 = getMerkleRoot(undefined);

      console.log("Testing empty transaction pools:");
      console.log(`Empty array root: ${emptyRoot1.substring(0, 16)}...`);
      console.log(`Null root: ${emptyRoot2.substring(0, 16)}...`);
      console.log(`Undefined root: ${emptyRoot3.substring(0, 16)}...`);
      console.log(
        `All empty roots identical: ${
          emptyRoot1 === emptyRoot2 && emptyRoot2 === emptyRoot3
        }\n`
      );

      expect(emptyRoot1).toBe(emptyRoot2);
      expect(emptyRoot2).toBe(emptyRoot3);
    });
  });

  describe("Node Class Tests", () => {
    it("should correctly initialize a node with transaction pool", () => {
      const transactions = [
        { id: "tx1", amount: 100 },
        { id: "tx2", amount: 200 },
      ];

      const node = new Node("TestNode", transactions);

      expect(node.id).toBe("TestNode");
      expect(node.transactionPool).toHaveLength(2);
      expect(node.transactionPool[0].id).toBe("tx1");
      expect(node.isSynced).toBe(false);
    });

    it("should correctly identify missing transactions", () => {
      const localTxs = [
        { id: "tx1", amount: 100 },
        { id: "tx2", amount: 200 },
      ];

      const peerTxs = [
        { id: "tx1", amount: 100 },
        { id: "tx2", amount: 200 },
        { id: "tx3", amount: 300 },
      ];

      const node = new Node("TestNode", localTxs);
      const missing = node.findMissingTransactions(peerTxs);

      console.log("Testing missing transaction identification:");
      console.log(
        `Local transactions: ${localTxs.map((tx) => tx.id).join(", ")}`
      );
      console.log(
        `Peer transactions: ${peerTxs.map((tx) => tx.id).join(", ")}`
      );
      console.log(
        `Missing transactions: ${missing.map((tx) => tx.id).join(", ")}\n`
      );

      expect(missing).toHaveLength(1);
      expect(missing[0].id).toBe("tx3");
    });
  });

  describe("End-to-End Synchronization Simulation", () => {
    it("should successfully simulate the complete synchronization process", () => {
      console.log("\n" + "=".repeat(60));
      console.log("RUNNING FULL SYNCHRONIZATION SIMULATION TEST");
      console.log("=".repeat(60) + "\n");

      // Run the main simulation
      const results = runSynchronizationSimulation();

      // Verify simulation results
      console.log("\n" + "-".repeat(40));
      console.log("VERIFYING SIMULATION RESULTS");
      console.log("-".repeat(40));

      // Test 1: Check that we have the expected number of nodes
      expect(results.nodes).toHaveLength(5);
      console.log("✓ Correct number of nodes created (5)");

      // Test 2: Verify that correct and divergent roots are different
      expect(results.correctRoot).not.toBe(results.divergentRoot);
      console.log("✓ Correct and divergent roots are different");
      console.log(`  Correct root: ${results.correctRoot.substring(0, 12)}...`);
      console.log(
        `  Divergent root: ${results.divergentRoot.substring(0, 12)}...`
      );

      // Test 3: Check that Node-3 was initially out of sync
      const node3Results = results.syncResults["Node-3"];
      expect(node3Results.localRoot).toBe(results.divergentRoot);
      expect(node3Results.isSynced).toBe(false);
      console.log("✓ Node-3 was correctly identified as out of sync initially");

      // Test 4: Check that majority root was correctly identified
      expect(node3Results.majorityRoot).toBe(results.correctRoot);
      console.log("✓ Majority root was correctly identified");

      // Test 5: Verify other nodes were in sync
      ["Node-1", "Node-2", "Node-4", "Node-5"].forEach((nodeId) => {
        const nodeResults = results.syncResults[nodeId];
        expect(nodeResults.localRoot).toBe(results.correctRoot);
        expect(nodeResults.isSynced).toBe(true);
      });
      console.log(
        "✓ All other nodes (Node-1, Node-2, Node-4, Node-5) were in sync"
      );

      // Test 6: Verify synchronization was successful
      expect(node3Results.newRoot).toBe(results.correctRoot);
      expect(node3Results.finalSyncStatus).toBe(true);
      console.log("✓ Node-3 successfully synchronized with the network");

      // Test 7: Verify Node-3 now has all transactions
      const node3 = results.nodes.find((n) => n.id === "Node-3");
      expect(node3.transactionPool).toHaveLength(3);
      expect(node3.transactionPool.some((tx) => tx.id === "tx3")).toBe(true);
      console.log("✓ Node-3 now has all required transactions");

      console.log("\n" + "=".repeat(60));
      console.log("SIMULATION TEST COMPLETED SUCCESSFULLY");
      console.log(
        "All assertions passed - the synchronization mechanism works!"
      );
      console.log("=".repeat(60));
    });

    it("should demonstrate timing compliance within 20-second rounds", () => {
      console.log("\n" + "-".repeat(50));
      console.log("TIMING ANALYSIS FOR 20-SECOND CONSENSUS ROUNDS");
      console.log("-".repeat(50));

      const startTime = Date.now();

      // Run simulation
      const results = runSynchronizationSimulation();

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      console.log(`\nSimulation execution time: ${executionTime}ms`);
      console.log("Timeline for 20-second consensus round:");
      console.log("  0s - 4s:   Bidding Phase");
      console.log("  4s - 16s:  Transaction Collection Phase");
      console.log(
        "  16s - 18s: Transaction Synchronization Phase (2 seconds available)"
      );
      console.log("  18s - 20s: Block Proposal Phase");

      // The synchronization should complete well within the 2-second window
      expect(executionTime).toBeLessThan(2000);

      console.log(
        `\n✓ Synchronization completed in ${executionTime}ms (well within 2-second window)`
      );
      console.log("✓ Timing requirements satisfied for real-time consensus");
    });
  });

  describe("Edge Cases and Robustness", () => {
    it("should handle scenarios with multiple divergent nodes", () => {
      console.log("\nTesting multiple divergent nodes scenario...");

      const correctTxs = [{ id: "tx1" }, { id: "tx2" }, { id: "tx3" }];
      const divergent1Txs = [{ id: "tx1" }, { id: "tx2" }]; // Missing tx3
      const divergent2Txs = [{ id: "tx1" }]; // Missing tx2 and tx3

      const nodes = [
        new Node("Correct-1", correctTxs),
        new Node("Correct-2", correctTxs),
        new Node("Correct-3", correctTxs),
        new Node("Divergent-1", divergent1Txs),
        new Node("Divergent-2", divergent2Txs),
      ];

      // Simulate root exchange
      const roots = nodes.map((node) => ({
        id: node.id,
        root: node.getLocalMerkleRoot(),
      }));

      nodes.forEach((node) => {
        roots.forEach(({ root }) => node.receivePeerRoot(root));
      });

      // Check majority detection
      nodes.forEach((node) => {
        const majorityRoot = node.findMajorityRoot();
        const isSynced = node.checkSynchronization();

        console.log(`${node.id}: ${isSynced ? "SYNCED" : "OUT OF SYNC"}`);

        if (node.id.startsWith("Correct")) {
          expect(isSynced).toBe(true);
        } else {
          expect(isSynced).toBe(false);
        }

        // All nodes should identify the same majority root (correct root)
        expect(majorityRoot).toBe(getMerkleRoot(correctTxs));
      });

      console.log("✓ Multiple divergent nodes correctly identified");
    });

    it("should handle network with no majority (split scenario)", () => {
      console.log("\nTesting network split scenario...");

      const txSet1 = [{ id: "tx1" }, { id: "tx2" }];
      const txSet2 = [{ id: "tx1" }, { id: "tx3" }];

      const nodes = [
        new Node("Group1-A", txSet1),
        new Node("Group1-B", txSet1),
        new Node("Group2-A", txSet2),
        new Node("Group2-B", txSet2),
      ];

      // Simulate root exchange
      const roots = nodes.map((node) => ({
        id: node.id,
        root: node.getLocalMerkleRoot(),
      }));

      nodes.forEach((node) => {
        roots.forEach(({ root }) => node.receivePeerRoot(root));
      });

      // In a split scenario, nodes should still find a majority
      // (in this case, it depends on tie-breaking logic)
      nodes.forEach((node) => {
        const majorityRoot = node.findMajorityRoot();
        expect(majorityRoot).toBeDefined();
        console.log(`${node.id}: Majority root identified`);
      });

      console.log("✓ Network split scenario handled gracefully");
    });
  });
});

// Run all tests
console.log("STARTING TRANSACTION SYNCHRONIZATION TESTS...\n");
