import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("users", {
    deleted_at: { type: "timestamp", default: null },
  });

  pgm.createIndex("users", "deleted_at");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("users", "deleted_at");
  pgm.dropColumn("users", "deleted_at");
}

