/**
 * Backfill script: sync existing DB reputation scores to on-chain.
 *
 * For each user with a stellar_public_key, reads the current DB reputation_score
 * and calls get_reputation on the Soroban contract. If they differ, updates the DB
 * to match the on-chain value (chain is authoritative).
 *
 * Usage:
 *   npx ts-node scripts/backfill-reputation.ts
 */
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
loadEnvConfig(process.cwd());

import { Pool } from "pg";
import { getOnChainReputation } from "../src/lib/reputation";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{
      id: string;
      stellar_public_key: string;
      reputation_score: number;
    }>(
      `SELECT id, stellar_public_key, reputation_score
       FROM users
       WHERE stellar_public_key IS NOT NULL AND stellar_public_key != ''`
    );

    console.log(`Backfilling reputation for ${rows.length} users...`);
    let updated = 0;

    for (const user of rows) {
      try {
        const onChainScore = await getOnChainReputation(user.stellar_public_key);
        if (onChainScore !== user.reputation_score) {
          await client.query(
            "UPDATE users SET reputation_score = $1 WHERE id = $2",
            [onChainScore, user.id]
          );
          console.log(
            `  ${user.id}: DB=${user.reputation_score} → chain=${onChainScore}`
          );
          updated++;
        }
      } catch (err) {
        console.warn(`  ${user.id}: failed to fetch on-chain score:`, err);
      }
    }

    console.log(`Done. Updated ${updated}/${rows.length} users.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
