const INITIAL_BALANCE = 500;
const PROPOSER_REWARD = 50;
const DIFFICULTY = 4;

const ROUND_INTERVAL = 120 * 1000; // 20 seconds in ms
const PHASE_1_DURATION = 15 * 1000; // First 4 seconds for publishing randomness
const PHASE_3_START = 100 * 1000; // Leader publishes block at 18th minute
const TRANSACTION_COLLECTION_DURATION = 85 * 1000; // Collect transactions for first 16 seconds
const CLEANUP_INDEX_FREQUENCY = 10; // every 10 indices clean the pending transactions
const CLEANUP_LIMIT = 5; // cleanup transactions older than 5 rounds

// Broadcast scheduling parameters
NUM_SLOTS = 10; // number of slots per round
SLOT_MS = 50; // each slot = 50ms → max 500, 0.5s to wait
PROPOSAL_SCHEDULE_DELAY = 2000; // wait 2 seconds before scheduling proposal broadcast

module.exports = {
  INITIAL_BALANCE,
  PROPOSER_REWARD,
  DIFFICULTY,
  ROUND_INTERVAL,
  PHASE_1_DURATION,
  PHASE_3_START,
  TRANSACTION_COLLECTION_DURATION,
  NUM_SLOTS,
  SLOT_MS,
  PROPOSAL_SCHEDULE_DELAY,
  CLEANUP_INDEX_FREQUENCY,
  CLEANUP_LIMIT,
};
