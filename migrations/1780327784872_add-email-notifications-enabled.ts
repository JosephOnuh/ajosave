import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add Email notification preferences to users table
  pgm.addColumn("users", {
    email_notifications_enabled: {
      type: "boolean",
      notNull: true,
      default: true,
    },
  });

  // Add missing columns to circles table
  pgm.addColumn("circles", {
    yield_strategy: {
      type: "varchar(20)",
      notNull: true,
      default: "none",
    },
    penalty_percent: {
      type: "numeric(5,2)",
      notNull: true,
      default: 10,
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn("circles", ["yield_strategy", "penalty_percent"]);
  // Remove Email notification preferences
  pgm.dropColumn("users", "email_notifications_enabled");
}



