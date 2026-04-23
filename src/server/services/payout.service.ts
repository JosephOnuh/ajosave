import { sendUsdcPayment } from "@/lib/stellar";
import { getCircleById, getMembersByCircle, updateCircleStatus } from "./circle.service";
import { withPayoutLock, PayoutLockError } from "./payout-lock";
import type { Payout } from "@/types";
import { randomUUID } from "crypto";

export { PayoutLockError };

// In-memory payout log — replace with DB
const payouts: Payout[] = [];

/**
 * Process a payout cycle for a circle:
 * 1. Acquire a per-circle lock to prevent concurrent sequence number conflicts
 * 2. Send the full pot (contributionUsdc × members) to the recipient's Stellar key
 * 3. Record the payout and advance the cycle
 *
 * Throws PayoutLockError immediately if a payout is already in progress for this circle.
 */
export async function processCyclePayout(
  circleId: string,
  recipientStellarKey: string
): Promise<Payout> {
  return withPayoutLock(circleId, async () => {
  const circle = await getCircleById(circleId);
  if (!circle) throw new Error("Circle not found");
  if (circle.status !== "active") throw new Error("Circle is not active");

  const circleMembers = await getMembersByCircle(circleId);
  const totalPot = (
    parseFloat(circle.contributionUsdc) * circleMembers.length
  ).toFixed(7);

  // sendUsdcPayment fetches a fresh account sequence number each call
  const txHash = await sendUsdcPayment(recipientStellarKey, totalPot);

  const payout: Payout = {
    id: randomUUID(),
    circleId,
    recipientMemberId: circleMembers[circle.currentCycle - 1]?.id ?? "",
    cycleNumber: circle.currentCycle,
    amountUsdc: totalPot,
    txHash,
    paidAt: new Date(),
  };

  payouts.push(payout);

  // Mark complete if all members have been paid
  if (circle.currentCycle >= circleMembers.length) {
    await updateCircleStatus(circleId, "completed");
  }

  return payout;
  }); // end withPayoutLock
}

export async function getPayoutsByCircle(circleId: string): Promise<Payout[]> {
  return payouts.filter((p) => p.circleId === circleId);
}
