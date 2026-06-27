import { query, transaction } from "@/lib/db";
import { randomUUID } from "crypto";
import logger from "@/lib/logger";

// Reward type is configurable via env; defaults to "fee_waiver".
// "fee_waiver" records the reward for the billing layer to honour.
// "usdc_credit"  would trigger an on-chain transfer (wired in payout.service).
export type ReferralRewardType = "fee_waiver" | "usdc_credit";
const REWARD_TYPE: ReferralRewardType =
  (process.env.REFERRAL_REWARD_TYPE as ReferralRewardType) ?? "fee_waiver";

/** Get or lazily create a referral code for a user. */
export async function getReferralCode(userId: string): Promise<string> {
  const { rows } = await query<{ referral_code: string }>(
    "SELECT referral_code FROM users WHERE id = $1",
    [userId]
  );
  if (rows[0]?.referral_code) return rows[0].referral_code;

  const code = userId.slice(0, 8).toUpperCase();
  await query(
    "UPDATE users SET referral_code = $1 WHERE id = $2 AND referral_code IS NULL",
    [code, userId]
  );
  return code;
}

/** Record that a new user signed up via a referral code. Idempotent on referred_id. */
export async function trackReferral(
  code: string,
  referredUserId: string
): Promise<{ referrerId: string } | null> {
  const { rows } = await query<{ id: string }>(
    "SELECT id FROM users WHERE referral_code = $1",
    [code]
  );
  const referrer = rows[0];
  if (!referrer || referrer.id === referredUserId) return null;

  await query(
    `UPDATE users SET referred_by = $1 WHERE id = $2 AND referred_by IS NULL`,
    [referrer.id, referredUserId]
  );

  // Upsert referral row (unique index on referred_id ensures idempotency)
  await query(
    `INSERT INTO referrals (id, referrer_id, referred_id, rewarded, created_at)
     VALUES ($1, $2, $3, false, NOW())
     ON CONFLICT (referred_id) DO NOTHING`,
    [randomUUID(), referrer.id, referredUserId]
  );

  return { referrerId: referrer.id };
}

/**
 * Grant a referral reward when the referred user makes their first confirmed contribution.
 * Idempotent: the referrals.rewarded flag and a transaction guard prevent double-grants.
 */
export async function grantReferralReward(referredUserId: string): Promise<void> {
  await transaction(async (q) => {
    // Lock and fetch the unrewarded referral for this user
    const { rows } = await q<{ id: string; referrer_id: string }>(
      `SELECT id, referrer_id FROM referrals
       WHERE referred_id = $1 AND rewarded = false
       FOR UPDATE SKIP LOCKED`,
      [referredUserId]
    );
    const referral = rows[0];
    if (!referral) return; // already rewarded or no referral

    // Mark rewarded immediately to prevent races
    await q(
      "UPDATE referrals SET rewarded = true, rewarded_at = NOW(), reward_type = $1 WHERE id = $2",
      [REWARD_TYPE, referral.id]
    );

    logger.info(
      { referralId: referral.id, referrerId: referral.referrer_id, referredUserId, rewardType: REWARD_TYPE },
      "[referral] Reward granted"
    );
  });
}

/** Return referral conversion metrics for the admin dashboard. */
export async function getReferralMetrics(): Promise<{
  total: number;
  rewarded: number;
  conversionRate: number;
}> {
  const { rows } = await query<{ total: string; rewarded: string }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE rewarded = true)::text AS rewarded
     FROM referrals`
  );
  const total = parseInt(rows[0]?.total ?? "0", 10);
  const rewarded = parseInt(rows[0]?.rewarded ?? "0", 10);
  return { total, rewarded, conversionRate: total > 0 ? rewarded / total : 0 };
}

/** Get all referrals made by a user. */
export async function getReferralsByUser(
  userId: string
): Promise<{ id: string; referredId: string; rewarded: boolean; createdAt: Date }[]> {
  const { rows } = await query<{ id: string; referredId: string; rewarded: boolean; createdAt: Date }>(
    `SELECT id, referred_id AS "referredId", rewarded, created_at AS "createdAt"
     FROM referrals WHERE referrer_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}
