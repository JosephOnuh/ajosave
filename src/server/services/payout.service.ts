import { sendUsdcPayment } from "@/lib/stellar";
import { getCircleById, getMembersByCircle, updateCircleStatus } from "./circle.service";
import type { Payout } from "@/types";
import { randomUUID } from "crypto";

// In-memory payout log — replace with DB
const payouts: Payout[] = [];

/**
 * Process a payout cycle for a circle:
 * 1. Find the next member in rotation who hasn't received payout
 * 2. Send the full pot (contributionUsdc × members) to their Stellar key
 * 3. Record the payout and advance the cycle
 *
 * In production: recipient's Stellar key comes from the user record in DB.
 */
export async function processCyclePayout(
  circleId: string,
  recipientStellarKey: string
): Promise<Payout> {
  const circle = await getCircleById(circleId);
  if (!circle) throw new Error("Circle not found");
  if (circle.status !== "active") throw new Error("Circle is not active");

  const circleMembers = await getMembersByCircle(circleId);
  const totalPot = (
    parseFloat(circle.contributionUsdc) * circleMembers.length
  ).toFixed(7);

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
}

export async function getPayoutsByCircle(circleId: string): Promise<Payout[]> {
  return payouts.filter((p) => p.circleId === circleId);
}
