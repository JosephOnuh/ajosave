import { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Add description column to circles table
  pgm.addColumn("circles", {
    description: {
      type: "text",
      check: "char_length(description) <= 500",
    },
  });

  // Add check constraints for existing columns
  pgm.addConstraint("circles", "circles_name_length_check", {
    check: "char_length(name) <= 100",
  });

  pgm.addConstraint("disputes", "disputes_reason_length_check", {
    check: "char_length(reason) <= 2000",
  });

  pgm.addConstraint("disputes", "disputes_evidence_length_check", {
    check: "char_length(evidence) <= 2000",
  });

  pgm.addConstraint("disputes", "disputes_resolution_notes_length_check", {
    check: "char_length(resolution_notes) <= 2000",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint("circles", "circles_name_length_check");
  pgm.dropConstraint("disputes", "disputes_reason_length_check");
  pgm.dropConstraint("disputes", "disputes_evidence_length_check");
  pgm.dropConstraint("disputes", "disputes_resolution_notes_length_check");
  pgm.dropColumn("circles", "description");
}
