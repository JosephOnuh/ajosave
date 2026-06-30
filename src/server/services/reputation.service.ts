import { query } from "@/lib/db";
import { getOnChainReputation } from "@/lib/reputation";

// Score adjustments.
const SCORE_INCREMENT = 5; // Points added on-time contribution
const SCORE_DECREMENT = 10; // Points deducted on missed contribution
const MIN_SCORE = 0;

/**
 * Update user reputation score when a contribution is missed/defaulted.
 * DB is updated as a cache; authoritative value lives on-chain.
 */
export async function decrementReputationOnMissedContribution(userId: string): Promise<number> {
  const { rows } = await query<{ reputation_score: number }>(
    `UPDATE users 
     SET reputation_score = GREATEST(reputation_score - $1, $2)
     WHERE id = $3
     RETURNING reputation_score`,
    [SCORE_DECREMENT, MIN_SCORE, userId]
  );
  return rows[0]?.reputation_score ?? 0;
}

/**
 * Get user's authoritative reputation score from the Soroban contract.
 * Falls back to DB cache when stellar_public_key is not set or chain is unreachable.
 */
export async function getUserReputation(userId: string): Promise<number> {
  const { rows } = await query<{ reputation_score: number; stellar_public_key: string | null }>(
    `SELECT reputation_score, stellar_public_key FROM users WHERE id = $1`,
    [userId]
  );
  const user = rows[0];
  if (!user) return 0;

  if (user.stellar_public_key) {
    const onChainScore = await getOnChainReputation(user.stellar_public_key);
    // Keep DB in sync as a cache
    if (onChainScore !== user.reputation_score) {
      await query("UPDATE users SET reputation_score = $1 WHERE id = $2", [onChainScore, userId]);
    }
    return onChainScore;
  }

  // Fallback: no Stellar key yet, return DB value
  return user.reputation_score ?? 0;
}

/**
 * Check if user meets the minimum reputation requirement for a circle.
 */
export async function checkReputationGate(
  userId: string,
  requiredScore: number
): Promise<{ eligible: boolean; currentScore: number }> {
  const currentScore = await getUserReputation(userId);
  return { eligible: currentScore >= requiredScore, currentScore };
}

/**
 * Calculate reputation level label based on score.
 */
export function getReputationLevel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Building";
}
