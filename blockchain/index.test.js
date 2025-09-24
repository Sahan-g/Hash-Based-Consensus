const Block = require("./block");
const db = require("../database");
const ChainUtil = require("../chain-util");
const Blockchain = require(".");

jest.mock("../database");
jest.mock("./block");
jest.mock("../chain-util");

describe("Blockchain", () => {
  let wallet;
  beforeEach(() => {
    jest.clearAllMocks();
    wallet = { publicKey: "fake-key", sign: jest.fn(() => "fake-signature") };
  });

  describe("create(wallet)", () => {
    it("loads blockchain from db if exist", async () => {
      db.getChain.mockResolvedValue([
        {
          index: 0,
          timestamp: 1630000000000,
          transactions: [],
          previousHash: "0",
          proposerPublicKey: "GENESIS",
          hash: "0000ed9e07bf3d957688ed7ac3b93aa78c24afaad55056818faab9f03be9aaec",
          wallet: { publicKey: "fake-key" },
        },
      ]);

      Block.fromObject.mockReturnValue({
        index: 0,
        timestamp: 1630000000000,
        transactions: [],
        previousHash: "0",
        proposerPublicKey: "GENESIS",
        hash: "0000ed9e07bf3d957688ed7ac3b93aa78c24afaad55056818faab9f03be9aaec",
        wallet: { publicKey: "fake-key" },
      });

      const blockchain = await Blockchain.create(wallet);
      expect(db.getChain).toHaveBeenCalled();
      expect(blockchain.chain.length).toBe(1);
    });
  });
});
