import { notFound } from "next/navigation";
import { getCircleById, getMembersByCircle } from "@/server/services/circle.service";
import { CircleStatusBadge } from "@/components/ui/CircleStatusBadge";
import { ContributeButton } from "@/components/circle/ContributeButton";
import { format } from "date-fns";
import type { Metadata } from "next";
import styles from "./page.module.css";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const circle = await getCircleById(params.id);
  return { title: circle?.name ?? "Circle" };
}

export default async function CircleDetailPage({ params }: Props) {
  const [circle, members] = await Promise.all([
    getCircleById(params.id),
    getMembersByCircle(params.id),
  ]);

  if (!circle) notFound();

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{circle.name}</h1>
            <CircleStatusBadge status={circle.status} />
          </div>
          {circle.status === "active" && (
            <ContributeButton circleId={circle.id} />
          )}
        </div>

        <div className={styles.grid}>
          <div className="card">
            <h2 className={styles.sectionTitle}>Circle Details</h2>
            <dl className={styles.details}>
              <div className={styles.detailRow}>
                <dt>Contribution</dt>
                <dd>₦{circle.contributionNgn.toLocaleString("en-NG")} / {circle.cycleFrequency}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Members</dt>
                <dd>{members.length} / {circle.maxMembers}</dd>
              </div>
              <div className={styles.detailRow}>
                <dt>Current Cycle</dt>
                <dd>{circle.currentCycle > 0 ? `Cycle ${circle.currentCycle}` : "Not started"}</dd>
              </div>
              {circle.nextPayoutAt && (
                <div className={styles.detailRow}>
                  <dt>Next Payout</dt>
                  <dd>{format(new Date(circle.nextPayoutAt), "MMM d, yyyy")}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="card">
            <h2 className={styles.sectionTitle}>
              Members <span className={styles.count}>({members.length})</span>
            </h2>
            {members.length === 0 ? (
              <p className={styles.empty}>No members yet.</p>
            ) : (
              <ol className={styles.memberList}>
                {members.map((m) => {
                  const isCurrent = m.position === circle.currentCycle;
                  const isPast = m.hasReceivedPayout;
                  return (
                    <li
                      key={m.id}
                      className={`${styles.memberItem} ${isCurrent ? styles.current : ""} ${isPast ? styles.past : ""}`}
                    >
                      <span className={styles.position}>#{m.position}</span>
                      <span className={styles.memberId}>
                        Member {m.userId.slice(0, 8)}…
                      </span>
                      {isCurrent && <span className={styles.tag}>Receiving now</span>}
                      {isPast && <span className={styles.tag}>Paid out</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
