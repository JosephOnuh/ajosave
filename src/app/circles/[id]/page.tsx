import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCircleById, getMembersByCircle } from "@/server/services/circle.service";
import { CircleStatusBadge } from "@/components/ui/CircleStatusBadge";
import { MemberPayoutList } from "@/components/circle/MemberPayoutList";
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
  const [circle, members, session] = await Promise.all([
    getCircleById(params.id),
    getMembersByCircle(params.id),
    getServerSession(authOptions),
  ]);

  if (!circle) notFound();

  const userId = (session?.user as { id?: string } | undefined)?.id;
  const isCreator = userId === circle.creatorId;

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{circle.name}</h1>
            <CircleStatusBadge status={circle.status} />
          </div>
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

          <MemberPayoutList
            circle={circle}
            initialMembers={members}
            isCreator={isCreator}
          />
        </div>
      </div>
    </div>
  );
}
