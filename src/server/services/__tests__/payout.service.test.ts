import { processCyclePayout, getPayoutsByCircle } from "@/server/services/payout.service";
import * as circleService from "@/server/services/circle.service";
import * as stellar from "@/lib/stellar";
import type { Circle, Member } from "@/types";

jest.mock("@/server/services/circle.service");
jest.mock("@/lib/stellar");

const mockGetCircleById = circleService.getCircleById as jest.MockedFunction<typeof circleService.getCircleById>;
const mockGetMembersByCircle = circleService.getMembersByCircle as jest.MockedFunction<typeof circleService.getMembersByCircle>;
const mockUpdateCircleStatus = circleService.updateCircleStatus as jest.MockedFunction<typeof circleService.updateCircleStatus>;
const mockSendUsdcPayment = stellar.sendUsdcPayment as jest.MockedFunction<typeof stellar.sendUsdcPayment>;

const CIRCLE_ID = "circle-1";
const RECIPIENT_KEY = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const TX_HASH = "abc123txhash";

function makeCircle(overrides: Partial<Circle> = {}): Circle {
  return {
    id: CIRCLE_ID,
    name: "Test Circle",
    creatorId: "user-1",
    contributionUsdc: "10.0000000",
    contributionNgn: 16000,
    maxMembers: 3,
    cycleFrequency: "monthly",
    status: "active",
    currentCycle: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMembers(count: number): Member[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `member-${i + 1}`,
    circleId: CIRCLE_ID,
    userId: `user-${i + 1}`,
    position: i + 1,
    status: "active",
    hasReceivedPayout: false,
    joinedAt: new Date(),
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpdateCircleStatus.mockResolvedValue(undefined);
  mockSendUsdcPayment.mockResolvedValue(TX_HASH);
});

describe("processCyclePayout", () => {
  describe("happy path", () => {
    it("sends payment for the correct total pot and returns a payout record", async () => {
      const members = makeMembers(3);
      mockGetCircleById.mockResolvedValue(makeCircle({ currentCycle: 1 }));
      mockGetMembersByCircle.mockResolvedValue(members);

      const payout = await processCyclePayout(CIRCLE_ID, RECIPIENT_KEY);

      // Total pot = 10 USDC × 3 members = 30.0000000
      expect(mockSendUsdcPayment).toHaveBeenCalledWith(RECIPIENT_KEY, "30.0000000");
      expect(payout.circleId).toBe(CIRCLE_ID);
      expect(payout.amountUsdc).toBe("30.0000000");
      expect(payout.txHash).toBe(TX_HASH);
      expect(payout.cycleNumber).toBe(1);
      expect(payout.recipientMemberId).toBe(members[0].id);
      expect(payout.id).toBeDefined();
      expect(payout.paidAt).toBeInstanceOf(Date);
    });

    it("does NOT mark circle completed when cycles remain", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle({ currentCycle: 1 }));
      mockGetMembersByCircle.mockResolvedValue(makeMembers(3));

      await processCyclePayout(CIRCLE_ID, RECIPIENT_KEY);

      expect(mockUpdateCircleStatus).not.toHaveBeenCalled();
    });

    it("marks circle completed when last member is paid", async () => {
      const members = makeMembers(3);
      mockGetCircleById.mockResolvedValue(makeCircle({ currentCycle: 3 }));
      mockGetMembersByCircle.mockResolvedValue(members);

      await processCyclePayout(CIRCLE_ID, RECIPIENT_KEY);

      expect(mockUpdateCircleStatus).toHaveBeenCalledWith(CIRCLE_ID, "completed");
    });

    it("appends payout to getPayoutsByCircle", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle());
      mockGetMembersByCircle.mockResolvedValue(makeMembers(2));

      const payout = await processCyclePayout(CIRCLE_ID, RECIPIENT_KEY);
      const all = await getPayoutsByCircle(CIRCLE_ID);

      expect(all).toContainEqual(payout);
    });
  });

  describe("error cases", () => {
    it("throws 'Circle not found' when circle does not exist", async () => {
      mockGetCircleById.mockResolvedValue(null);

      await expect(processCyclePayout(CIRCLE_ID, RECIPIENT_KEY)).rejects.toThrow(
        "Circle not found"
      );
      expect(mockSendUsdcPayment).not.toHaveBeenCalled();
    });

    it("throws 'Circle is not active' when circle status is 'open'", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle({ status: "open" }));

      await expect(processCyclePayout(CIRCLE_ID, RECIPIENT_KEY)).rejects.toThrow(
        "Circle is not active"
      );
      expect(mockSendUsdcPayment).not.toHaveBeenCalled();
    });

    it("throws 'Circle is not active' when circle status is 'completed'", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle({ status: "completed" }));

      await expect(processCyclePayout(CIRCLE_ID, RECIPIENT_KEY)).rejects.toThrow(
        "Circle is not active"
      );
    });

    it("throws 'Circle is not active' when circle status is 'cancelled'", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle({ status: "cancelled" }));

      await expect(processCyclePayout(CIRCLE_ID, RECIPIENT_KEY)).rejects.toThrow(
        "Circle is not active"
      );
    });

    it("propagates Stellar SDK errors", async () => {
      mockGetCircleById.mockResolvedValue(makeCircle());
      mockGetMembersByCircle.mockResolvedValue(makeMembers(2));
      mockSendUsdcPayment.mockRejectedValue(new Error("Stellar network error"));

      await expect(processCyclePayout(CIRCLE_ID, RECIPIENT_KEY)).rejects.toThrow(
        "Stellar network error"
      );
    });
  });
});

describe("getPayoutsByCircle", () => {
  it("returns empty array for a circle with no payouts", async () => {
    const result = await getPayoutsByCircle("unknown-circle");
    expect(result).toEqual([]);
  });
});
