import { MigrationBuilder } from "node-pg-migrate";

/**
 * Issue #486: Add composite indexes for high-traffic query patterns.
 *
 * Targets the most frequent filter combinations observed in circle.service.ts
 * and payout.service.ts to eliminate full table scans as data grows.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // (circle_id, status) — used in getCircleMembers filtering active members,
  // and in contribution queries filtering by status within a circle
  pgm.createIndex("members", ["circle_id", "status"], {
    name: "idx_members_circle_id_status",
    ifNotExists: true,
  });

  pgm.createIndex("contributions", ["circle_id", "status"], {
    name: "idx_contributions_circle_id_status",
    ifNotExists: true,
  });

  // (user_id, circle_id) — used in membership lookups by user across circles
  // and in contribution history queries scoped to a specific user+circle pair
  pgm.createIndex("members", ["user_id", "circle_id"], {
    name: "idx_members_user_id_circle_id",
    ifNotExists: true,
  });

  // (created_at DESC) — used in recent-first list queries on contributions and circles
  pgm.createIndex("contributions", [{ name: "created_at", sort: "DESC" }], {
    name: "idx_contributions_created_at_desc",
    ifNotExists: true,
  });

  pgm.createIndex("circles", [{ name: "created_at", sort: "DESC" }], {
    name: "idx_circles_created_at_desc",
    ifNotExists: true,
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropIndex("circles", [{ name: "created_at", sort: "DESC" }], {
    name: "idx_circles_created_at_desc",
    ifExists: true,
  });
  pgm.dropIndex("contributions", [{ name: "created_at", sort: "DESC" }], {
    name: "idx_contributions_created_at_desc",
    ifExists: true,
  });
  pgm.dropIndex("members", ["user_id", "circle_id"], {
    name: "idx_members_user_id_circle_id",
    ifExists: true,
  });
  pgm.dropIndex("contributions", ["circle_id", "status"], {
    name: "idx_contributions_circle_id_status",
    ifExists: true,
  });
  pgm.dropIndex("members", ["circle_id", "status"], {
    name: "idx_members_circle_id_status",
    ifExists: true,
  });
}
