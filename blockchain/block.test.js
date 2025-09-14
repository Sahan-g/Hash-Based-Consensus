const Block = require("./block");
const ChainUtil = require("../chain-util");

describe("Block", () => {
  //mock wallet
  let wallet;

  beforeEach(() => {
    wallet = {
      publicKey: "fake-public-key",
      sign: jest.fn(() => ({
        r: "fake-r",
        s: "fake-s",
        recoveryParam: 1,
      })),
    };
  });

  //Test the constructor
  describe("constructor", () => {
    it("should set properties correctly", () => {
      // const timestamp =
      const blockData = {
        index: 2,
        timestamp: 123456,
        transactions: [],
        previousHash: "abc123",
        proposerPublicKey: wallet.publicKey,
        wallet,
      };
      //hash and signature -> automatically created

      const block = new Block(blockData);

      expect(block.index).toBe(blockData.index);
      expect(block.timestamp).toBe(blockData.timestamp);
      expect(block.transactions).toBe(blockData.transactions);
      expect(block.previousHash).toBe(blockData.previousHash);
      expect(block.proposerPublicKey).toBe(block.proposerPublicKey);
      expect(block.signature).toEqual({
        r: "fake-r",
        s: "fake-s",
        recoveryParam: 1,
      });
      expect(block.hash).toBeDefined(); //check block.hash has a value or undefined
    });
  });

  describe("computeHash", () => {
    it("compute hash correctly", () => {
      const blockData = {
        index: 2,
        timestamp: 123456,
        transactions: [],
        previousHash: "abc123",
        proposerPublicKey: wallet.publicKey,
        wallet,
      };

      const block = new Block(blockData);

      const testBlockString =
        blockData.index +
        JSON.stringify(blockData.transactions) +
        blockData.previousHash;
      const expectedHash = ChainUtil.createHash(testBlockString);
      expect(block.computeHash()).toBe(expectedHash);
    });
  });

  describe("genesis", () => {
    it("generate genesis correclty with defined propery values", () => {
      const genesisBlock = Block.genesis(wallet);

      expect(genesisBlock.index).toBe(0);
      expect(genesisBlock.transactions).toEqual([]);
      expect(genesisBlock.previousHash).toBe("0");
      expect(genesisBlock.proposerPublicKey).toBe("GENESIS");
      const expectedHash = ChainUtil.createHash(
        genesisBlock.index +
          JSON.stringify(genesisBlock.transactions) +
          genesisBlock.previousHash
      );
      expect(genesisBlock.hash).toBe(expectedHash);
      expect(genesisBlock.signature).toEqual({
        r: "fake-r",
        s: "fake-s",
        recoveryParam: 1,
      });
    });
  });

  // Use .toBe() for primitives (string, number, boolean, null, undefined).
  // Use .toEqual() for objects and arrays (check contents, not references).
  // Use .toStrictEqual() if you want to also ensure types and undefined properties match.

  describe("verify block", () => {
    it("return true for valid block", () => {
      const block = new Block({
        index: 2,
        timestamp: 12345,
        transactions: [],
        previousHash: "abc123",
        proposerPublicKey: wallet.publicKey,
        wallet,
      });

      jest.spyOn(ChainUtil, "verifySignature").mockReturnValue(true);
      expect(Block.verifyBlock(block)).toBe(true);
    });

    it("returns false for invalid block", () => {
      const block = new Block({
        index: 1,
        timestamp: Date.now(),
        transactions: [],
        previousHash: "abc123",
        proposerPublicKey: wallet.publicKey,
        wallet,
      });

      block.hash = "wrong-hash";
      expect(Block.verifyBlock(block)).toBe(false);
    });

    it("returns false for invalid block signature", () => {
      const block = new Block({
        index: 1,
        timestamp: Date.now(),
        transactions: [],
        previousHash: "abc123",
        proposerPublicKey: wallet.publicKey,
        wallet,
      });
      jest.spyOn(ChainUtil, "verifySignature").mockReturnValue(false);
      expect(Block.verifyBlock(block)).toBe(false);
    });
  });

  describe("isValidBlock", () => {
    it("return true for valid next block", () => {
      const prevBlock = Block.genesis(wallet);
      const block = new Block({
        index: 1,
        timestamp: prevBlock.timestamp + 1000,
        transactions: [],
        previousHash: prevBlock.hash,
        proposerPublicKey: wallet.publicKey,
        wallet,
      });

      expect(Block.isValidBlock(block, prevBlock)).toBe(true);
    });

    it("return false for wrong index", () => {
      const prevBlock = Block.genesis(wallet);
      const block = new Block({
        index: 2, //should be 1 actually
        timestamp: prevBlock.timestamp + 1000,
        transactions: [],
        previousHash: prevBlock.hash,
        proposerPublicKey: wallet.publicKey,
        wallet,
      });

      expect(Block.isValidBlock(block, prevBlock)).toBe(false);
    });

    it("returns false for invalid previous hash", () => {
      const prevBlock = Block.genesis(wallet);
      const block = new Block({
        index: 1,
        timestamp: prevBlock.timestamp + 1000,
        transactions: [],
        previousHash: "abc123",
        proposerPublicKey: wallet.publicKey,
        wallet,
      });

      expect(Block.isValidBlock(block, prevBlock)).toBe(false);
    });

    it("return false for invalid timestamp", () => {
      const prevBlock = Block.genesis(wallet);
      const block = new Block({
        index: 1,
        timestamp: prevBlock.timestamp - 1000,
        transactions: [],
        previousHash: prevBlock.hash,
        proposerPublicKey: wallet.publicKey,
        wallet,
      });

      expect(Block.isValidBlock(block, prevBlock)).toBe(false);
    });
  });

  describe("from Object", () => {
    it("returns block object from plain object", () => {
      const obj = {
        index: 1,
        timestamp: 123,
        transactions: [],
        previousHash: "abc123",
        proposerPublicKey: wallet.publicKey,
        hash: "some-hash",
        signature: {
          r: "fake-r",
          s: "fake-s",
          recoveryParam: 1,
        },
      };

      const block = Block.fromObject(obj);
      expect(block).toBeInstanceOf(Block);
      expect(block.hash).toBe("some-hash");
      expect(block.signature).toEqual({
        r: "fake-r",
        s: "fake-s",
        recoveryParam: 1,
      });
    });
  });
});
