// sample data
const bidHashTable = {
  "04a5b2c3d4e5f6789012345678901234567890123456789012345678901234567890abcdef123456789012345678901234567890":
    {
      round: 1,
      bidHash:
        "7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730",
      timestamp: 1722470400000,
      signature:
        "3045022100abc123def456789012345678901234567890123456789012345678901234567890022056789012345678901234567890123456789012345678901234567890123456",
    },

  "04b6c3d4e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890abcdef":
    {
      round: 1,
      bidHash:
        "9f2c7b4a8e3d1f5c6a9b2e8d7c4f1a6b9e2d5c8f1a4b7e0d3c6f9a2e5d8c1f4a7b",
      timestamp: 1722456000000,
      signature:
        "304502210098765432109876543210987654321098765432109876543210987654321098765432022043210987654321098765432109876543210987654321098765432109876543210",
    },

  "04c7d4e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456":
    {
      round: 1,
      bidHash:
        "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890",
      timestamp: 1722463200000,
      signature:
        "3046022100def789012345678901234567890123456789012345678901234567890123456789022100456789012345678901234567890123456789012345678901234567890123456789",
    },

  "04d8e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789":
    {
      round: 1,
      bidHash:
        "b3c4d5e6f7890123456789012345678901234567890123456789012345678901234567890123456789012345678901",
      timestamp: 1722477600000,
      signature:
        "30450221009876543210987654321098765432109876543210987654321098765432109876543202206543210987654321098765432109876543210987654321098765432109876543210",
    },

  "04e9f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012":
    {
      round: 1,
      bidHash:
        "c5d6e7f8901234567890123456789012345678901234567890123456789012345678901234567890123456789012",
      timestamp: 1722449800000,
      signature:
        "304402201234567890123456789012345678901234567890123456789012345678901234567890220187654321098765432109876543210987654321098765432109876543210987654321",
    },

  "04f0a7890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123":
    {
      round: 1,
      bidHash:
        "d7e8f9012345678901234567890123456789012345678901234567890123456789012345678901234567890123",
      timestamp: 1722484800000,
      signature:
        "3045022100fedcba098765432109876543210987654321098765432109876543210987654321098765432022078901234567890123456789012345678901234567890123456789012345678901234",
    },

  "04a1b8901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234":
    {
      round: 1,
      bidHash:
        "e9f0123456789012345678901234567890123456789012345678901234567890123456789012345678901234",
      timestamp: 1722492000000,
      signature:
        "304602210087654321098765432109876543210987654321098765432109876543210987654321098765432102203456789012345678901234567890123456789012345678901234567890123456789012",
    },

  "04b2c9012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345":
    {
      round: 1,
      bidHash:
        "f1234567890123456789012345678901234567890123456789012345678901234567890123456789012345",
      timestamp: 1722499200000,
      signature:
        "30440220234567890123456789012345678901234567890123456789012345678901234567890123456789022056789012345678901234567890123456789012345678901234567890123456789012345",
    },
};

// transform BidList to HashTable with publicKey as key
function transformBidManagerToHashTable(bidManagerMap, targetRound) {
  const hashTable = {};
  const roundBids = bidManagerMap.get(targetRound);

  if (!roundBids || roundBids.length === 0) {
    console.log(`No bids found for round ${targetRound}`);
    return hashTable;
  }
  roundBids.forEach((bidPacket) => {
    hashTable[bidPacket.publicKey] = {
      round: bidPacket.round,
      bidHash: bidPacket.bidHash,
      timestamp: bidPacket.timestamp,
      signature: bidPacket.signature,
    };
  });

  return hashTable;
}

// data for testing
// function createSampleBidManagerData() {
//   const bidManagerMap = new Map();

//   // Create sample BidPackets for round 1
//   const round1Bids = [
//     {
//       publicKey:
//         "04a5b2c3d4e5f6789012345678901234567890123456789012345678901234567890abcdef123456789012345678901234567890",
//       round: 1,
//       bidHash:
//         "7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730",
//       timestamp: 1722470400000,
//       signature:
//         "3045022100abc123def456789012345678901234567890123456789012345678901234567890022056789012345678901234567890123456789012345678901234567890123456",
//     },
//     {
//       publicKey:
//         "04b6c3d4e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890abcdef",
//       round: 1,
//       bidHash:
//         "9f2c7b4a8e3d1f5c6a9b2e8d7c4f1a6b9e2d5c8f1a4b7e0d3c6f9a2e5d8c1f4a7b",
//       timestamp: 1722456000000,
//       signature:
//         "304502210098765432109876543210987654321098765432109876543210987654321098765432022043210987654321098765432109876543210987654321098765432109876543210",
//     },
//     {
//       publicKey:
//         "04c7d4e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456",
//       round: 1,
//       bidHash:
//         "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890123456789012345678901234567890",
//       timestamp: 1722463200000,
//       signature:
//         "3046022100def789012345678901234567890123456789012345678901234567890123456789022100456789012345678901234567890123456789012345678901234567890123456789",
//     },
//   ];

//   bidManagerMap.set(1, round1Bids);

//   return bidManagerMap;
// }

// Test function to verify transformation works

// function testTransformation() {
//   console.log("=== Testing BidManager to HashTable Transformation ===");

//   // Create sample BidManager data
//   const sampleBidManagerMap = createSampleBidManagerData();
//   console.log("Sample BidManager Map:", sampleBidManagerMap);

//   // Transform to hash table format
//   const transformedHashTable = transformBidManagerToHashTable(
//     sampleBidManagerMap,
//     1
//   );
//   console.log("Transformed to HashTable:", transformedHashTable);

//   // Compare with our original sample data
//   console.log("Original sample data:", bidHashTable);

//   // Check if they match (first 3 entries)
//   const originalKeys = Object.keys(bidHashTable).slice(0, 3);
//   const transformedKeys = Object.keys(transformedHashTable);

//   console.log(
//     "Keys match:",
//     JSON.stringify(originalKeys.sort()) ===
//       JSON.stringify(transformedKeys.sort())
//   );

//   return transformedHashTable;
// }

// Optimized function to convert hash table to minimal array with only publicKey and bidValue
function createOptimizedBidArray(hashTable) {
  const bidArray = [];

  for (const publicKey in hashTable) {
    const bid = hashTable[publicKey];
    bidArray.push({
      publicKey: publicKey,
      bidValue: BigInt("0x" + bid.bidHash),
    });
  }

  return bidArray;
}

// Optimized sorting with tie-breaker: sort by bidValue first, then by publicKey for ties
function sortBidsOptimized(bidArray) {
  return bidArray.sort((a, b) => {
    // Primary sort: by bid value
    if (a.bidValue < b.bidValue) return -1;
    if (a.bidValue > b.bidValue) return 1;

    // Tie-breaker: by public key (lexicographic order)
    return a.publicKey.localeCompare(b.publicKey);
  });
}

// Binary search to find the closest bid value efficiently
function findClosestBidBinarySearch(sortedBidArray, targetBidHash) {
  const targetValue = BigInt("0x" + targetBidHash);

  if (sortedBidArray.length === 0) {
    return null;
  }

  let left = 0;
  let right = sortedBidArray.length - 1;
  let closestBid = sortedBidArray[0];
  let minDifference =
    targetValue > closestBid.bidValue
      ? targetValue - closestBid.bidValue
      : closestBid.bidValue - targetValue;

  // Binary search for closest position
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const currentBid = sortedBidArray[mid];
    const difference =
      targetValue > currentBid.bidValue
        ? targetValue - currentBid.bidValue
        : currentBid.bidValue - targetValue;

    // Update closest if this is better, or if it's a tie and has lower public key
    if (
      difference < minDifference ||
      (difference === minDifference &&
        currentBid.publicKey < closestBid.publicKey)
    ) {
      minDifference = difference;
      closestBid = currentBid;
    }

    if (currentBid.bidValue === targetValue) {
      // Exact match found, but check for ties with lower public keys
      let exactMatch = currentBid;

      // Check left neighbors for ties with lower public keys
      for (
        let i = mid - 1;
        i >= 0 && sortedBidArray[i].bidValue === targetValue;
        i--
      ) {
        if (sortedBidArray[i].publicKey < exactMatch.publicKey) {
          exactMatch = sortedBidArray[i];
        }
      }

      return exactMatch.publicKey;
    } else if (currentBid.bidValue < targetValue) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  // Check neighbors of the final position for potentially closer values
  const finalPos = Math.min(left, sortedBidArray.length - 1);

  for (
    let i = Math.max(0, finalPos - 1);
    i <= Math.min(sortedBidArray.length - 1, finalPos + 1);
    i++
  ) {
    const candidate = sortedBidArray[i];
    const difference =
      targetValue > candidate.bidValue
        ? targetValue - candidate.bidValue
        : candidate.bidValue - targetValue;

    if (
      difference < minDifference ||
      (difference === minDifference &&
        candidate.publicKey < closestBid.publicKey)
    ) {
      minDifference = difference;
      closestBid = candidate;
    }
  }

  return closestBid.publicKey;
}

// Main optimized function that returns only the public key
function findClosestBidPublicKey(hashTable, targetBidHash) {
  const bidArray = createOptimizedBidArray(hashTable);
  const sortedBids = sortBidsOptimized(bidArray);
  return findClosestBidBinarySearch(sortedBids, targetBidHash);
}
//-------------------------------------------------------------------------------------

function performanceTest(hashTable, testName) {
  console.log(`\n=== ${testName} Performance Test ===`);
  console.log(`Testing with ${Object.keys(hashTable).length} entries`);

  // Test 1: Create optimized array
  const start1 = performance.now();
  const bidArray = createOptimizedBidArray(hashTable);
  const end1 = performance.now();
  console.log(`Array creation: ${(end1 - start1).toFixed(3)}ms`);

  // Test 2: Sort the array
  const start2 = performance.now();
  const sortedBids = sortBidsOptimized(bidArray);
  const end2 = performance.now();
  console.log(`Sorting: ${(end2 - start2).toFixed(3)}ms`);

  // Test 3: Find closest bid (multiple searches for average)
  const targetHashes = [
    "8a2d64b7f9c1e3a5b8d7f2c4e6a9b3d5f8c1e4a7b0d3f6c9e2a5d8f1c4e7a0b3d6",
    "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234",
    "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321fedc",
    "5555555555555555555555555555555555555555555555555555555555555555",
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  ];

  const start3 = performance.now();
  let results = [];
  for (const target of targetHashes) {
    const result = findClosestBidBinarySearch(sortedBids, target);
    results.push(result);
  }
  const end3 = performance.now();
  console.log(`5 closest bid searches: ${(end3 - start3).toFixed(3)}ms`);
  console.log(`Average per search: ${((end3 - start3) / 5).toFixed(3)}ms`);

  // Total time
  const totalTime = end1 - start1 + (end2 - start2) + (end3 - start3);
  console.log(`Total processing time: ${totalTime.toFixed(3)}ms`);

  return {
    arrayCreation: end1 - start1,
    sorting: end2 - start2,
    searching: (end3 - start3) / 5,
    total: totalTime,
    entryCount: Object.keys(hashTable).length,
  };
}

// Generate 1000-entry sample data
function generateLargeBidHashTable(count = 1000) {
  const largeBidHashTable = {};

  function randomHex(length) {
    let result = "";
    const chars = "abcdef0123456789";
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  function randomSignature() {
    return "3045" + randomHex(60) + "0220" + randomHex(60);
  }

  for (let i = 0; i < count; i++) {
    const publicKey = "04" + randomHex(126); // 128 hex chars total
    largeBidHashTable[publicKey] = {
      round: 1,
      bidHash: randomHex(64),
      timestamp: 1722470400000 + i * 1000,
      signature: randomSignature(),
    };
  }

  return largeBidHashTable;
}

// Performance tests
console.log("=== Performance Testing ===");

// Test with small dataset (8 entries)
const smallResults = performanceTest(bidHashTable, "Small Dataset (8 entries)");

// Test with large dataset (1000 entries)
const largeBidHashTable = generateLargeBidHashTable(1000);
const largeResults = performanceTest(
  largeBidHashTable,
  "Large Dataset (1000 entries)"
);

// Performance analysis
console.log("\n=== Performance Analysis ===");
console.log(`Small dataset (${smallResults.entryCount} entries):`);
console.log(`  - Array creation: ${smallResults.arrayCreation.toFixed(3)}ms`);
console.log(`  - Sorting: ${smallResults.sorting.toFixed(3)}ms`);
console.log(`  - Binary search: ${smallResults.searching.toFixed(3)}ms`);
console.log(`  - Total: ${smallResults.total.toFixed(3)}ms`);

console.log(`\nLarge dataset (${largeResults.entryCount} entries):`);
console.log(`  - Array creation: ${largeResults.arrayCreation.toFixed(3)}ms`);
console.log(`  - Sorting: ${largeResults.sorting.toFixed(3)}ms`);
console.log(`  - Binary search: ${largeResults.searching.toFixed(3)}ms`);
console.log(`  - Total: ${largeResults.total.toFixed(3)}ms`);

// // Example target bid hash
// const targetBidHash = "8a2d64b7f9c1e3a5b8d7f2c4e6a9b3d5f8c1e4a7b0d3f6c9e2a5d8f1c4e7a0b3d6";
// const closestPublicKey = findClosestBidPublicKey(bidHashTable, targetBidHash);
// console.log(`\nExample: Closest bid public key to target ${targetBidHash}:`);
// console.log(closestPublicKey);

module.exports = {
  bidHashTable,
  transformBidManagerToHashTable,
  createOptimizedBidArray,
  sortBidsOptimized,
  findClosestBidBinarySearch,
  findClosestBidPublicKey,
  performanceTest,
  generateLargeBidHashTable,
};
