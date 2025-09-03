const INITIAL_BALANCE = 500;
const PROPOSER_REWARD = 50;
const DIFFICULTY = 4;

const ROUND_INTERVAL = 60 * 1000; // 20 seconds in ms
const PHASE_1_DURATION = 10 * 1000; // First 4 seconds for publishing randomness
const PHASE_3_START = 50  * 1000; // Leader publishes block at 18th minute
const TRANSACTION_COLLECTION_DURATION = 45 * 1000; // Collect transactions for first 16 seconds

const HEARTBEAT_INTERVAL = 30000;   // 30 seconds
const HEARTBEAT_TIMEOUT  = 60000;   // 60 seconds


module.exports = {
  INITIAL_BALANCE,
  PROPOSER_REWARD,
  DIFFICULTY,
  ROUND_INTERVAL,
  PHASE_1_DURATION,
  PHASE_3_START,
  HEARTBEAT_INTERVAL,
  HEARTBEAT_TIMEOUT,
  TRANSACTION_COLLECTION_DURATION
};
