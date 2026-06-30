import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("circles", {
    payout_method: {
      type: "varchar(20)",
      notNull: true,
      default: "fixed",
    },
    randomization_seed: {
      type: "varchar(255)",
    },
  });

  pgm.addColumn("members", {
    updated_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn("circles", ["payout_method", "randomization_seed"]);
  pgm.dropColumn("members", ["updated_at"]);
}

