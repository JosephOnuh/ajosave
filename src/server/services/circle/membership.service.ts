import { query, transaction } from "@/lib/db";
import { randomUUID } from "crypto";
import type { Circle, Member } from "@/types";
import { CIRCLE_SELECT, MEMBER_SELECT, computeNextPayoutDate, createSeededRandom } from "./shared";

export async function joinCircle(
  circleId: string,
  userId: string,
  isInvited = false
): Promise<Member> {
  return transaction(async (q) => {
    const { rows: circleRows } = await q<Circle>(
      `SELECT ${CIRCLE_SELECT} FROM circles WHERE id = $1 FOR UPDATE`,
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.status !== "open") throw new Error("Circle is not open for joining");

    const { rows: memberRows } = await q<Member>(
      `SELECT ${MEMBER_SELECT} FROM members m JOIN users u ON u.id = m.user_id WHERE m.circle_id = $1 AND m.status IN ('active', 'pending')`,
      [circleId]
    );
    if (memberRows.length >= circle.maxMembers) throw new Error("Circle is full");
    if (memberRows.some((m) => m.userId === userId)) throw new Error("Already a member");

    // Private circles require approval unless the user is explicitly invited
    const isPrivate = circle.circleType === "private";
    const status = (isPrivate && !isInvited) ? "pending" : "active";
    const position = status === "active" ? memberRows.filter(m => m.status === "active").length + 1 : null;
    const reviewedAt = (status === "active" && isPrivate) ? new Date() : null;

    const { rows: newMember } = await q<Member>(
      `WITH ins AS (
         INSERT INTO members (id, circle_id, user_id, position, status, has_received_payout, joined_at, reviewed_at)
         VALUES ($1,$2,$3,$4,$5,false,NOW(),$6) RETURNING *
       )
       SELECT ${MEMBER_SELECT} FROM ins m JOIN users u ON u.id = m.user_id`,
      [randomUUID(), circleId, userId, position, status, reviewedAt]
    );

    // Auto-start when full (count only active members)
    const activeMembers = memberRows.filter(m => m.status === "active").length + (status === "active" ? 1 : 0);
    if (activeMembers === circle.maxMembers) {
      await q(
        `UPDATE circles
         SET status='active', current_cycle=1, next_payout_at=$1, updated_at=NOW()
         WHERE id=$2`,
        [computeNextPayoutDate(circle.cycleFrequency), circleId]
      );
    }

    return newMember[0];
  });
}

export async function approveJoinRequest(
  circleId: string,
  memberId: string,
  creatorId: string
): Promise<Member> {
  return transaction(async (q) => {
    const { rows: circleRows } = await q<Circle>(
      "SELECT * FROM circles WHERE id = $1 FOR UPDATE",
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.creatorId !== creatorId) throw new Error("Only the creator can approve join requests");
    if (circle.circleType !== "private") throw new Error("Only private circles require approval");

    const { rows: memberRows } = await q<Member>(
      "SELECT * FROM members WHERE id = $1 AND circle_id = $2",
      [memberId, circleId]
    );
    const member = memberRows[0];
    if (!member) throw new Error("Member not found");
    if (member.status !== "pending") throw new Error("Member is not pending approval");

    const { rows: activeMembers } = await q<Member>(
      "SELECT * FROM members WHERE circle_id = $1 AND status = 'active'",
      [circleId]
    );
    const position = activeMembers.length + 1;

    const { rows: updatedMember } = await q<Member>(
      `UPDATE members
       SET status = 'active', position = $1, reviewed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [position, memberId]
    );

    // Auto-start circle if now full
    if (activeMembers.length + 1 === circle.maxMembers) {
      await q(
        `UPDATE circles
         SET status='active', current_cycle=1, next_payout_at=$1, updated_at=NOW()
         WHERE id=$2`,
        [computeNextPayoutDate(circle.cycleFrequency), circleId]
      );
    }

    return updatedMember[0];
  });
}

export async function rejectJoinRequest(
  circleId: string,
  memberId: string,
  creatorId: string
): Promise<Member> {
  return transaction(async (q) => {
    const { rows: circleRows } = await q<Circle>(
      "SELECT * FROM circles WHERE id = $1",
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.creatorId !== creatorId) throw new Error("Only the creator can reject join requests");
    if (circle.circleType !== "private") throw new Error("Only private circles require approval");

    const { rows: memberRows } = await q<Member>(
      "SELECT * FROM members WHERE id = $1 AND circle_id = $2",
      [memberId, circleId]
    );
    const member = memberRows[0];
    if (!member) throw new Error("Member not found");
    if (member.status !== "pending") throw new Error("Member is not pending approval");

    const { rows: updatedMember } = await q<Member>(
      `UPDATE members
       SET status = 'rejected', reviewed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [memberId]
    );

    return updatedMember[0];
  });
}

export async function getPendingJoinRequests(circleId: string): Promise<Member[]> {
  const { rows } = await query<Member>(
    "SELECT * FROM members WHERE circle_id = $1 AND status = 'pending' ORDER BY joined_at ASC",
    [circleId]
  );
  return rows;
}

export async function shuffleAndPersistPositions(
  circleId: string,
  seed: string
): Promise<Member[]> {
  return transaction(async (q) => {
    const { rows: circleRows } = await q<Circle>(
      `SELECT ${CIRCLE_SELECT} FROM circles WHERE id = $1 FOR UPDATE`,
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.status !== "open") throw new Error("Positions can only be shuffled before the circle starts");

    const { rows: memberRows } = await q<Member>(
      `SELECT ${MEMBER_SELECT} FROM members m JOIN users u ON u.id = m.user_id WHERE m.circle_id = $1 ORDER BY m.position`,
      [circleId]
    );

    // Fisher-Yates shuffle using seed for deterministic randomization
    const positions = memberRows.map((_, i) => i + 1);
    const seededRandom = createSeededRandom(seed);
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    for (let i = 0; i < memberRows.length; i++) {
      await q(
        "UPDATE members SET position = $1, updated_at = NOW() WHERE id = $2",
        [positions[i], memberRows[i].id]
      );
    }

    await q(
      "UPDATE circles SET payout_method = 'randomized', randomization_seed = $1, updated_at = NOW() WHERE id = $2",
      [seed, circleId]
    );

    const shuffled = memberRows.map((m, i) => ({ ...m, position: positions[i] }));
    return shuffled.sort((a, b) => a.position - b.position);
  });
}

export async function leaveCircle(
  circleId: string,
  userId: string
): Promise<void> {
  let circleName = "";
  await transaction(async (q) => {
    const { rows: circleRows } = await q<Circle>(
      "SELECT * FROM circles WHERE id = $1 FOR UPDATE",
      [circleId]
    );
    const circle = circleRows[0];
    if (!circle) throw new Error("Circle not found");
    if (circle.status !== "open") throw new Error("Can only leave open circles");
    if (circle.creatorId === userId) throw new Error("Creator cannot leave the circle; cancel it instead");

    circleName = circle.name;

    const { rowCount } = await q(
      "DELETE FROM members WHERE circle_id = $1 AND user_id = $2",
      [circleId, userId]
    );
    if (rowCount === 0) throw new Error("Not a member of this circle");

    // Re-assign positions for remaining active members to keep them contiguous
    const { rows: remainingMembers } = await q<Member>(
      "SELECT id FROM members WHERE circle_id = $1 AND status = 'active' ORDER BY position ASC",
      [circleId]
    );

    for (let i = 0; i < remainingMembers.length; i++) {
      await q(
        "UPDATE members SET position = $1 WHERE id = $2",
        [i + 1, remainingMembers[i].id]
      );
    }
  });

  // Trigger waitlist notification if a spot opens up (async, non-blocking)
  try {
    const { getFirstWaitlistMember } = await import("../waitlist.service");
    const nextUser = await getFirstWaitlistMember(circleId);
    if (nextUser) {
      const { notifyWaitlistSpotOpened } = await import("../notification.service");
      notifyWaitlistSpotOpened(nextUser, circleName).catch((err) =>
        console.error(`[leaveCircle] SMS notification failed for ${nextUser}:`, err)
      );
    }
  } catch (err) {
    console.error(`[leaveCircle] Failed to process waitlist notification for circle ${circleId}:`, err);
  }
}
