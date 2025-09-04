const INITIAL_BALANCE = 500;
const PROPOSER_REWARD = 50;
const DIFFICULTY = 4;

const ROUND_INTERVAL = 20 * 1000; // 20 seconds in ms
const PHASE_1_DURATION = 4 * 1000; // First 4 seconds for publishing randomness
const PHASE_3_START = 18  * 1000; // Leader publishes block at 18th minute
const TRANSACTION_COLLECTION_DURATION = 16 * 1000; // Collect transactions for first 16 seconds


module.exports = {
  INITIAL_BALANCE,
  PROPOSER_REWARD,
  DIFFICULTY,
  ROUND_INTERVAL,
  PHASE_1_DURATION,
  PHASE_3_START,
  TRANSACTION_COLLECTION_DURATION
};
