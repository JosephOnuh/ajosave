import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Issue #478: Add reward tracking fields to referrals table.
 * - rewarded_at: timestamp when the reward was granted
 * - reward_type: "fee_waiver" | "usdc_credit" (configurable)
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns("referrals", {
    rewarded_at: { type: "timestamp" },
    reward_type: { type: "varchar(32)" },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns("referrals", ["rewarded_at", "reward_type"]);
}
