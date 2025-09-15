const ChainUtil = require("../chain-util");
const BidPacket = require("./bid-packet");

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

  ChainUtil.createHash = jest.fn((data) => `hash-${data}`);
  ChainUtil.verifySignature = jest.fn(() => true);
});

describe("Bid-Packet", () => {
  describe("constructor", () => {
    it("should set properties correclty and sign the data", () => {
      const testBidData = {
        publicKey: wallet.publicKey,
        round: 1,
        bidHash: "abc123",
        timestamp: 11111,
        wallet,
      };
      const bidPacket = new BidPacket(testBidData);
      expect(bidPacket.publicKey).toBe(testBidData.publicKey);
      expect(bidPacket.round).toBe(testBidData.round);
      expect(bidPacket.bidHash).toBe(testBidData.bidHash);
      expect(bidPacket.timestamp).toBe(testBidData.timestamp);

      const expectedData = `${testBidData.publicKey}-${testBidData.round}-${testBidData.bidHash}-${testBidData.timestamp}`;
      expect(ChainUtil.createHash).toHaveBeenCalledWith(expectedData);
      expect(wallet.sign).toHaveBeenCalledWith(`hash-${expectedData}`);
      expect(bidPacket.signature).toEqual({
        r: "fake-r",
        s: "fake-s",
        recoveryParam: 1,
      });
    });

    it("should use Date.now() is timestamp is not proviced", () => {
      const nowSpy = jest.spyOn(Date, "now").mockReturnValue(999999);
      const bidPacket = new BidPacket({
        publicKey: wallet.publicKey,
        round: 2,
        bidHash: "abc123",
        wallet,
      });

      expect(bidPacket.timestamp).toBe(999999);
      nowSpy.mockRestore();
    });
  });

  describe("verifyBid(bidPacket)", () => {
    it("returns true for valid signature", () => {
      const testBidData = {
        publicKey: wallet.publicKey,
        round: 2,
        bidHash: "123Abc",
        timestamp: 999999,
        signature: "signature",
      };

      const isVerifyBid = BidPacket.verifyBid(testBidData);
      const expectedString = `${testBidData.publicKey}-${testBidData.round}-${testBidData.bidHash}-${testBidData.timestamp}`;
      expect(ChainUtil.createHash).toHaveBeenCalledWith(expectedString);
      expect(ChainUtil.verifySignature).toHaveBeenCalledWith(
        testBidData.publicKey,
        testBidData.signature,
        `hash-${expectedString}`
      );
      expect(isVerifyBid).toBe(true);
    });

    it("returns false for invalid signature", () => {
      ChainUtil.verifySignature.mockReturnValue(false);
      const testBidData = {
        publicKey: wallet.publicKey,
        round: 2,
        bidHash: "123Abc",
        timestamp: 999999,
        signature: "signature",
      };

      const isVerifyBid = BidPacket.verifyBid(testBidData);
      expect(isVerifyBid).toBe(false);
    });
  });
});
