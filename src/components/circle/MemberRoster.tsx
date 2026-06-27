"use client";

import { Member } from "@/types";
import type { ContributionRow } from "@/server/services/contribution.service";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import styles from "./MemberRoster.module.css";

interface MemberRosterProps {
  members: Member[];
  currentCycle: number;
  contributions?: ContributionRow[];
}

type CycleStatus = "paid" | "partial" | "unpaid" | "n/a";

function getCycleStatus(member: Member, currentCycle: number, contributions: ContributionRow[]): CycleStatus {
  if (member.status !== "active" || currentCycle === 0) return "n/a";
  const memberContribs = contributions.filter(
    (c) => c.memberId === member.id && c.cycleNumber === currentCycle
  );
  if (memberContribs.some((c) => c.status === "confirmed")) return "paid";
  if (memberContribs.some((c) => c.status === "pending")) return "partial";
  return "unpaid";
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  pending: "Pending",
  defaulted: "Defaulted",
  completed: "Completed",
  rejected: "Rejected",
};

const CYCLE_LABEL: Record<CycleStatus, string> = {
  paid: "Paid ✓",
  partial: "Partial",
  unpaid: "Unpaid",
  "n/a": "—",
};

export function MemberRoster({ members, currentCycle, contributions = [] }: MemberRosterProps) {
  const sorted = [...members].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));

  return (
    <section className={styles.roster} aria-label="Circle member roster">
      <h2 className={styles.title}>Members ({members.length})</h2>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <caption className="sr-only">
            Circle members with payout position, membership status, and current cycle contribution status
          </caption>
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Position</th>
              <th scope="col">Status</th>
              <th scope="col">This Cycle</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((member) => {
              const cycleStatus = getCycleStatus(member, currentCycle, contributions);
              const isDefaulted = member.status === "defaulted";
              return (
                <tr
                  key={member.id}
                  className={isDefaulted ? styles.defaultedRow : ""}
                  aria-label={`${member.displayName ?? member.userId}, ${STATUS_LABEL[member.status] ?? member.status}`}
                >
                  <td>
                    <div className={styles.memberCell}>
                      <MemberAvatar displayName={member.displayName} userId={member.userId} />
                      <div className={styles.memberInfo}>
                        <span className={styles.name}>{member.displayName ?? `${member.userId.slice(0, 8)}…`}</span>
                      </div>
                    </div>
                  </td>
                  <td className={styles.positionCell}>
                    {member.position !== null ? `#${member.position}` : "TBD"}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles[`badge_${member.status}`]}`}>
                      {STATUS_LABEL[member.status] ?? member.status}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.cycleBadge} ${styles[`cycle_${cycleStatus.replace("/", "")}`]}`}>
                      {CYCLE_LABEL[cycleStatus]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
