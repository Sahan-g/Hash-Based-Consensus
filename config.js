const INITIAL_BALANCE = 500;
const PROPOSER_REWARD = 50;
const DIFFICULTY = 4;

const ROUND_INTERVAL = 10 * 60 * 1000; // 10 minutes in ms
const PHASE_1_DURATION = 2 * 60 * 1000; // First 2 minutes for publishing randomness
const PHASE_3_START = 9 * 60 * 1000; // Leader publishes block at 9th minute

module.exports = {
  INITIAL_BALANCE,
  PROPOSER_REWARD,
  DIFFICULTY,
  ROUND_INTERVAL,
  PHASE_1_DURATION,
  PHASE_3_START,
};
