import { sendUsdcPayment } from "@/lib/stellar";
import { invokeContractPayout } from "@/lib/soroban";
import { getCircleById, getMembersByCircle, updateCircleStatus } from "./circle.service";
import { withPayoutLock, PayoutLockError } from "./payout-lock";
import type { Payout } from "@/types";
import { randomUUID } from "crypto";

export { PayoutLockError };

// In-memory payout log — replace with DB
const payouts: Payout[] = [];

/**
 * Process a payout cycle for a circle.
 *
 * If the circle has a contractId, the Soroban contract is the source of truth:
 * it handles the token transfer and rotation internally.
 *
 * Falls back to direct Horizon payment for circles without a deployed contract.
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

  let txHash: string;
  if (circle.contractId) {
    // Soroban path: contract handles transfer, backend only triggers payout()
    txHash = await invokeContractPayout(circle.contractId);
  } else {
    // Horizon fallback for circles without a deployed contract
    txHash = await sendUsdcPayment(recipientStellarKey, totalPot);
  }

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

  if (circle.currentCycle >= circleMembers.length) {
    await updateCircleStatus(circleId, "completed");
  }

  return payout;
  }); // end withPayoutLock
}

export async function getPayoutsByCircle(circleId: string): Promise<Payout[]> {
  return payouts.filter((p) => p.circleId === circleId);
}
