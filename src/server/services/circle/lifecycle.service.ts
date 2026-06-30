import { query, transaction } from "@/lib/db";
import type { Circle } from "@/types";
import { sendUsdcPayment, validateStellarRecipient } from "@/lib/stellar";
import {
  notifyCircleCancelled,
  notifyCirclePaused,
  notifyCircleResumed,
} from "../notification.service";
import { CIRCLE_SELECT } from "./shared";

/**
 * Cancel an open circle, issue USDC refunds to members who already paid,
 * and notify all members via SMS.
 *
 * Rules:
 * - Only the circle creator can cancel.
 * - Only circles with status 'open' can be cancelled (not active/completed).
 * - Each member with confirmed contributions receives a USDC refund to their
 *   Stellar public key. Members without a Stellar key are skipped and their
 *   contributions are left as 'refund_pending' for manual resolution.
 * - The circle status is set to 'cancelled' atomically before refunds are sent.
 *   Refunds are best-effort: failures are logged but do not roll back the cancellation.
 */
export async function cancelCircle(
  circleId: string,
  requesterId: string
): Promise<Circle> {
  // ── Step 1: Validate and atomically cancel the circle ──────────────────────
  const circle = await transaction(async (q) => {
    const { rows: circleRows } = await q<{
      id: string;
      name: string;
      creator_id: string;
      status: string;
      contribution_usdc: string;
    }>(
      "SELECT id, name, creator_id, status, contribution_usdc FROM circles WHERE id = $1 FOR UPDATE",
      [circleId]
    );
    const raw = circleRows[0];
    if (!raw) throw new Error("Circle not found");
    if (raw.creator_id !== requesterId) throw new Error("Only the creator can cancel a circle");
    if (raw.status !== "open") throw new Error("Only open circles can be cancelled");

    // Mark confirmed contributions as refund_pending within the same transaction
    await q(
      `UPDATE contributions
       SET status = 'refund_pending', updated_at = NOW()
       WHERE circle_id = $1 AND status = 'confirmed'`,
      [circleId]
    );

    const { rows: updated } = await q<Circle>(
      `UPDATE circles
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, creator_id as "creatorId",
                 contribution_usdc as "contributionUsdc",
                 contribution_ngn as "contributionFiat",
                 'NGN' as "contributionCurrency",
                 max_members as "maxMembers",
                 cycle_frequency as "cycleFrequency",
                 payout_method as "payoutMethod",
                 randomization_seed as "randomizationSeed",
                 status, contract_id as "contractId",
                 current_cycle as "currentCycle",
                 next_payout_at as "nextPayoutAt",
                 created_at as "createdAt",
                 updated_at as "updatedAt"`,
      [circleId]
    );
    return updated[0];
  });

  // ── Step 2: Fetch members with refund_pending contributions ────────────────
  const { rows: refundRows } = await query<{
    member_id: string;
    user_id: string;
    stellar_public_key: string | null;
    total_usdc: string;
  }>(
    `SELECT
       c.member_id,
       m.user_id,
       u.stellar_public_key,
       SUM(c.amount_usdc)::text AS total_usdc
     FROM contributions c
     JOIN members m ON m.id = c.member_id
     JOIN users u ON u.id = m.user_id
     WHERE c.circle_id = $1 AND c.status = 'refund_pending'
     GROUP BY c.member_id, m.user_id, u.stellar_public_key`,
    [circleId]
  );

  // ── Step 3: Issue refunds and notify members (best-effort, non-blocking) ───
  const refundJobs = refundRows.map(async (row) => {
    const { member_id, user_id, stellar_public_key, total_usdc } = row;

    if (!stellar_public_key) {
      // No Stellar key on file — leave as refund_pending for manual resolution
      console.warn(
        `[cancelCircle] Member ${member_id} has no Stellar key; skipping refund (left as refund_pending)`
      );
      notifyCircleCancelled(user_id, circle.name, null).catch((err) =>
        console.error(`[cancelCircle] SMS notification failed for ${user_id}:`, err)
      );
      return;
    }

    try {
      await validateStellarRecipient(stellar_public_key);
      const txHash = await sendUsdcPayment(stellar_public_key, total_usdc);

      // Mark contributions as refunded and record the tx hash
      await query(
        `UPDATE contributions
         SET status = 'refunded', tx_hash = $1, updated_at = NOW()
         WHERE circle_id = $2 AND member_id = $3 AND status = 'refund_pending'`,
        [txHash, circleId, member_id]
      );

      console.log(
        `[cancelCircle] Refunded ${total_usdc} USDC to member ${member_id} (tx: ${txHash})`
      );

      notifyCircleCancelled(user_id, circle.name, total_usdc).catch((err) =>
        console.error(`[cancelCircle] SMS notification failed for ${user_id}:`, err)
      );
    } catch (err) {
      // Refund failed — leave as refund_pending for retry/manual resolution
      console.error(
        `[cancelCircle] Refund failed for member ${member_id} (${total_usdc} USDC):`,
        err
      );
      notifyCircleCancelled(user_id, circle.name, null).catch((notifyErr) =>
        console.error(`[cancelCircle] SMS notification failed for ${user_id}:`, notifyErr)
      );
    }
  });

  // Notify members with no contributions (joined but never paid)
  const { rows: noContribMembers } = await query<{ user_id: string }>(
    `SELECT DISTINCT m.user_id
     FROM members m
     WHERE m.circle_id = $1
       AND m.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM contributions c
         WHERE c.member_id = m.id AND c.circle_id = $1
       )`,
    [circleId]
  );

  const noContribJobs = noContribMembers.map(({ user_id }) =>
    notifyCircleCancelled(user_id, circle.name, null).catch((err) =>
      console.error(`[cancelCircle] SMS notification failed for ${user_id}:`, err)
    )
  );

  // Fire all refunds and notifications concurrently; don't block the response
  Promise.allSettled([...refundJobs, ...noContribJobs]).catch((err) =>
    console.error("[cancelCircle] Unexpected error in refund/notification batch:", err)
  );

  return circle;
}

export async function pauseCircle(
  circleId: string,
  creatorId: string
): Promise<Circle> {
  return transaction(async (q) => {
    const { rows } = await q<Circle>(
      `SELECT ${CIRCLE_SELECT} FROM circles WHERE id = $1 FOR UPDATE`,
      [circleId]
    );
    const circle = rows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.creatorId !== creatorId) throw new Error("Only creator can pause the circle");
    if (circle.status !== "active") throw new Error("Only active circles can be paused");

    const { rows: updated } = await q<Circle>(
      `UPDATE circles
       SET status = 'paused', paused_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING ${CIRCLE_SELECT}`,
      [circleId]
    );

    // Notify all members
    const { rows: members } = await q<{ userId: string }>(
      `SELECT user_id as "userId" FROM members WHERE circle_id = $1 AND status = 'active'`,
      [circleId]
    );
    await notifyCirclePaused(members.map(m => m.userId), circle.name);

    return updated[0];
  });
}

export async function resumeCircle(
  circleId: string,
  creatorId: string
): Promise<Circle> {
  return transaction(async (q) => {
    const { rows } = await q<Circle>(
      `SELECT ${CIRCLE_SELECT} FROM circles WHERE id = $1 FOR UPDATE`,
      [circleId]
    );
    const circle = rows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.creatorId !== creatorId) throw new Error("Only creator can resume the circle");
    if (circle.status !== "paused") throw new Error("Circle is not paused");

    // Calculate pause duration and extend nextPayoutAt
    const pausedAt = circle.pausedAt ? new Date(circle.pausedAt) : new Date();
    const now = new Date();
    const durationMs = now.getTime() - pausedAt.getTime();

    let nextPayoutAt = circle.nextPayoutAt ? new Date(circle.nextPayoutAt) : null;
    if (nextPayoutAt) {
      nextPayoutAt = new Date(nextPayoutAt.getTime() + durationMs);
    }

    const { rows: updated } = await q<Circle>(
      `UPDATE circles
       SET status = 'active', next_payout_at = $2, paused_at = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING ${CIRCLE_SELECT}`,
      [circleId, nextPayoutAt]
    );

    // Notify all members
    const { rows: members } = await q<{ userId: string }>(
      `SELECT user_id as "userId" FROM members WHERE circle_id = $1 AND status = 'active'`,
      [circleId]
    );
    await notifyCircleResumed(members.map(m => m.userId), circle.name);

    return updated[0];
  });
}

/**
 * Soft-delete a circle by setting deleted_at.
 * Only the creator or an admin can delete. Deleted circles are hidden from all
 * public queries but remain in the database for historical reference.
 */
export async function deleteCircle(
  circleId: string,
  requesterId: string,
  isAdmin = false
): Promise<void> {
  const { rows } = await query<{ creator_id: string }>(
    "SELECT creator_id FROM circles WHERE id = $1 AND deleted_at IS NULL",
    [circleId]
  );
  if (!rows[0]) throw new Error("Circle not found");
  if (!isAdmin && rows[0].creator_id !== requesterId) throw new Error("Only the creator can delete this circle");
  await query("UPDATE circles SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1", [circleId]);
}
