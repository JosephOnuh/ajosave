import { query } from "@/lib/db";

export async function up(): Promise<void> {
  await query(`ALTER TABLE circles ADD COLUMN IF NOT EXISTS paystack_plan_code TEXT`);
  await query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT`);
}

export async function down(): Promise<void> {
  await query(`ALTER TABLE circles DROP COLUMN IF EXISTS paystack_plan_code`);
  await query(`ALTER TABLE members DROP COLUMN IF EXISTS paystack_subscription_code`);
}
