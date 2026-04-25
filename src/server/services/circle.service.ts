import { query, transaction } from "@/lib/db";
import { randomUUID } from "crypto";
import type { Circle, Member, CircleStatus } from "@/types";
import type { CreateCircleInput } from "@/types/schemas";
import { getNgnPerUsdc } from "@/lib/fx";

export const ngnToUsdc = async (ngn: number): Promise<string> => {
  const rate = await getNgnPerUsdc();
  return (ngn / rate).toFixed(7);
};

export async function createCircle(
  creatorId: string,
  input: CreateCircleInput
): Promise<Circle> {
  const id = randomUUID();
  const contributionUsdc = await ngnToUsdc(input.contributionNgn);
  const { rows } = await query<Circle>(
    `INSERT INTO circles
       (id, name, creator_id, contribution_usdc, contribution_ngn,
        max_members, cycle_frequency, status, current_cycle, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'open',0,NOW(),NOW())
     RETURNING *`,
    [id, input.name, creatorId, contributionUsdc, input.contributionNgn,
     input.maxMembers, input.cycleFrequency]
  );
  return rows[0];
}

export async function getCircleById(id: string): Promise<Circle | null> {
  const { rows } = await query<Circle>(
    "SELECT * FROM circles WHERE id = $1",
    [id]
  );
  return rows[0] ?? null;
}

export async function listOpenCircles(): Promise<Circle[]> {
  const { rows } = await query<Circle>(
    "SELECT * FROM circles WHERE status = 'open' ORDER BY created_at DESC"
  );
  return rows;
}

export async function getCirclesByUser(userId: string): Promise<Circle[]> {
  const { rows } = await query<Circle>(
    `SELECT DISTINCT c.* FROM circles c
     LEFT JOIN members m ON m.circle_id = c.id
     WHERE c.creator_id = $1 OR m.user_id = $1
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function joinCircle(
  circleId: string,
  userId: string
): Promise<Member> {
  return transaction(async (q) => {
    const { rows: circleRows } = await q<Circle>(
      "SELECT * FROM circles WHERE id = $1 FOR UPDATE",
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.status !== "open") throw new Error("Circle is not open for joining");

    const { rows: memberRows } = await q<Member>(
      "SELECT * FROM members WHERE circle_id = $1",
      [circleId]
    );
    if (memberRows.length >= circle.maxMembers) throw new Error("Circle is full");
    if (memberRows.some((m) => m.userId === userId)) throw new Error("Already a member");

    const { rows: newMember } = await q<Member>(
      `INSERT INTO members (id, circle_id, user_id, position, status, has_received_payout, joined_at)
       VALUES ($1,$2,$3,$4,'active',false,NOW()) RETURNING *`,
      [randomUUID(), circleId, userId, memberRows.length + 1]
    );

    // Auto-start when full
    if (memberRows.length + 1 === circle.maxMembers) {
      await q(
        `UPDATE circles
         SET status='active', current_cycle=1,
             next_payout_at=$1, updated_at=NOW()
         WHERE id=$2`,
        [computeNextPayoutDate(circle.cycleFrequency), circleId]
      );
    }

    return newMember[0];
  });
}

export async function getMembersByCircle(circleId: string): Promise<Member[]> {
  const { rows } = await query<Member>(
    "SELECT * FROM members WHERE circle_id = $1 ORDER BY position",
    [circleId]
  );
  return rows;
}

export async function updateCircleStatus(id: string, status: CircleStatus): Promise<void> {
  await query(
    "UPDATE circles SET status=$1, updated_at=NOW() WHERE id=$2",
    [status, id]
  );
}

function computeNextPayoutDate(frequency: Circle["cycleFrequency"]): Date {
  const d = new Date();
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d;
}
