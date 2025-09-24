const BidPacket = require("./bid-packet");
const ChainUtil = require("../chain-util");
const { ROUND_INTERVAL } = require("../config");
const BidManager = require("./bid-manager");

jest.mock("../chain-util");
jest.mock("./bid-packet");

describe("BidManager", () => {
  let blockchain, wallet, bidManager;

  beforeEach(() => {
    wallet = {
      publicKey: "fake-public-key",
      sign: jest.fn(() => ({
        r: "fake-r",
        s: "fake-s",
        recoveryParam: 1,
      })),
    };
    blockchain = {
      getLastBlock: jest.fn().mockReturnValue({
        index: 5,
        timestamp: 123456,
        transactions: [],
        previousHash: "abc123",
        proposerPublicKey: wallet.publicKey,
        wallet,
      }),
    };

    ChainUtil.createHash.mockReturnValue("fake-bid-hash");
    BidPacket.mockClear();
    BidPacket.mockImplementation(({ publicKey, round, bidHash, wallet }) => ({
      publicKey,
      round,
      bidHash,
      wallet,
    }));

    bidManager = new BidManager(wallet.publicKey, blockchain);
  });

  describe("constructor", () => {
    it("initialize with correct properties", () => {
      expect(bidManager.selfPublicKey).toBe("fake-public-key");
      expect(bidManager.round).toBe(6);
      expect(bidManager.bidList).toBeInstanceOf(Map);
    });
  });

  describe("generateBid", () => {
    it("generates a bid and adds it to the bid list", () => {
      const bidPacket = bidManager.generateBid(6, wallet);
      expect(ChainUtil.createHash).toHaveBeenCalled();
      expect(BidPacket).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: "fake-public-key",
          round: 6,
          wallet,
        })
      );
      const bids = bidManager.getAllBids(6);
      console.log("bids: ", bids);
      expect(bids[0]).toEqual(bidPacket);
    });
  });

  describe("receiveBid(bidPacket)", () => {
    it("returns false if bid verification fails", () => {
      BidPacket.verifyBid = jest.fn().mockReturnValue(false);
      const result = bidManager.receiveBid({ round: 6 });
      expect(result).toBe(false);
    });

    it("returns true if bid verification succeeds", () => {
      BidPacket.verifyBid = jest.fn().mockReturnValue(true);
      const bidPacket = { round: 6, publicKey: "peer-key", bidHash: "abc" };
      const result = bidManager.receiveBid(bidPacket);

      expect(result).toBe(true);
      expect(bidManager.getAllBids(6)).toContain(bidPacket);
    });
  });

  describe("handleRound(round)", () => {
    it("updates the round if the new round is greater", () => {
      bidManager.handleRound(7);
      expect(bidManager.round).toBe(7);
    });

    it("does not update if round is lower or equal", () => {
      bidManager.handleRound(5);
      expect(bidManager.round).toBe(6);
    });
  });

  describe("selectProposer(round,blockHash)", () => {
    it("returns proposer with closest bid", () => {
      const fakeBlockHash = "a".repeat(64);
      const bid1 = { publicKey: "A", bidHash: "b".repeat(64), round: 6 };
      const bid2 = { publicKey: "B", bidHash: "c".repeat(64), round: 6 };

      bidManager.addToBidList(bid1);
      bidManager.addToBidList(bid2);

      const proposer = bidManager.selectProposer(6, fakeBlockHash);
      expect(["A", "B"]).toContain(proposer); // one of them should be selected
    });
  });
});
