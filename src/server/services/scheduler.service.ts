/**
 * Cycle processor — runs on a schedule (Vercel Cron: hourly).
 * Finds active circles whose nextPayoutAt has passed and triggers payouts.
 * In production: query DB, fetch recipient Stellar keys, call processCyclePayout.
 */
export async function processDueCycles(): Promise<void> {
  // TODO: query DB for circles WHERE status='active' AND next_payout_at <= NOW()
  // For each: call processCyclePayout(circle.id, recipientStellarKey)
  console.warn("[scheduler] processDueCycles — wire up DB query here");
}
