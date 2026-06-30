import { query } from "@/lib/db";
import { randomUUID } from "crypto";
import type { Circle, Member, CircleStatus, CycleFrequency } from "@/types";
import type { CreateCircleInput } from "@/types/schemas";
import { getFiatPerUsdc } from "@/lib/fx";
import { deployAjoContract } from "@/lib/soroban";
import { CIRCLE_SELECT, MEMBER_SELECT } from "./shared";

export const fiatToUsdc = async (amount: number, currency: string): Promise<string> => {
  const rate = await getFiatPerUsdc(currency);
  return (amount / rate).toFixed(7);
};

export interface PaginatedCircles {
  data: Circle[];
  total: number;
  page: number;
  limit: number;
}

export interface CircleFilters {
  frequency?: CycleFrequency;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  search?: string;
  status?: CircleStatus;
}

export async function createCircle(
  creatorId: string,
  input: CreateCircleInput
): Promise<Circle> {
  const id = randomUUID();
  const contributionUsdc = await fiatToUsdc(input.contributionAmount, input.contributionCurrency);

  // Deploy a dedicated Soroban contract instance for this circle
  let contractId: string | null = null;
  try {
    contractId = await deployAjoContract();
  } catch (err) {
    console.error("[createCircle] Contract deployment failed, proceeding without contractId:", err);
  }

  const { rows } = await query<Circle>(
    `INSERT INTO circles
       (id, name, creator_id, contribution_usdc, contribution_fiat, contribution_currency,
        max_members, cycle_frequency, payout_method, contract_id, grace_period_hours, status, current_cycle, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'open',0,NOW(),NOW())
     RETURNING ${CIRCLE_SELECT}`,
    [id, input.name, creatorId, contributionUsdc, input.contributionAmount, input.contributionCurrency,
     input.maxMembers, input.cycleFrequency, input.payoutMethod, contractId, input.gracePeriodHours ?? 24]
  );
  return rows[0];
}

export async function getCircleById(id: string): Promise<Circle | null> {
  const { rows } = await query<Circle>(
    `SELECT ${CIRCLE_SELECT} FROM circles WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] ?? null;
}

export async function listOpenCircles(
  page = 1,
  limit = 20,
  filters: CircleFilters = {}
): Promise<PaginatedCircles> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  const statusFilter: CircleStatus = filters.status ?? "open";
  const queryParams: unknown[] = [statusFilter];
  let paramIndex = 2;

  let queryText = `SELECT ${CIRCLE_SELECT} FROM circles WHERE status = $1 AND deleted_at IS NULL`;
  let countQueryText = "SELECT COUNT(*) FROM circles WHERE status = $1 AND deleted_at IS NULL";

  if (filters.frequency) {
    queryText += ` AND cycle_frequency = $${paramIndex}`;
    countQueryText += ` AND cycle_frequency = $${paramIndex}`;
    queryParams.push(filters.frequency);
    paramIndex++;
  }

  if (filters.currency) {
    queryText += ` AND contribution_currency = $${paramIndex}`;
    countQueryText += ` AND contribution_currency = $${paramIndex}`;
    queryParams.push(filters.currency);
    paramIndex++;
  }

  if (filters.minAmount !== undefined) {
    queryText += ` AND contribution_fiat >= $${paramIndex}`;
    countQueryText += ` AND contribution_fiat >= $${paramIndex}`;
    queryParams.push(filters.minAmount);
    paramIndex++;
  }

  if (filters.maxAmount !== undefined) {
    queryText += ` AND contribution_fiat <= $${paramIndex}`;
    countQueryText += ` AND contribution_fiat <= $${paramIndex}`;
    queryParams.push(filters.maxAmount);
    paramIndex++;
  }

  if (filters.search) {
    queryText += ` AND name ILIKE $${paramIndex}`;
    countQueryText += ` AND name ILIKE $${paramIndex}`;
    queryParams.push(`%${filters.search}%`);
    paramIndex++;
  }

  queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  const finalParams = [...queryParams, safeLimit, offset];

  const [{ rows }, { rows: countRows }] = await Promise.all([
    query<Circle>(queryText, finalParams),
    query<{ count: string }>(countQueryText, queryParams),
  ]);

  return { data: rows, total: parseInt(countRows[0].count, 10), page: safePage, limit: safeLimit };
}

export async function getCirclesByUser(userId: string): Promise<Circle[]> {
  const { rows } = await query<Circle>(
    `SELECT DISTINCT c.id, c.name, c.creator_id as "creatorId",
        c.contribution_usdc as "contributionUsdc",
        c.contribution_fiat as "contributionFiat",
        c.contribution_currency as "contributionCurrency",
        c.circle_type as "circleType",
        c.max_members as "maxMembers",
        c.cycle_frequency as "cycleFrequency",
        c.payout_method as "payoutMethod",
        c.randomization_seed as "randomizationSeed",
        c.status, c.contract_id as "contractId",
        c.current_cycle as "currentCycle",
        c.next_payout_at as "nextPayoutAt",
        c.created_at as "createdAt",
        c.updated_at as "updatedAt"
     FROM circles c
     LEFT JOIN members m ON m.circle_id = c.id
     WHERE (c.creator_id = $1 OR m.user_id = $1) AND c.deleted_at IS NULL
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function getMembersByCircle(circleId: string): Promise<Member[]> {
  const { rows } = await query<Member>(
    `SELECT ${MEMBER_SELECT} FROM members m JOIN users u ON u.id = m.user_id WHERE m.circle_id = $1 ORDER BY m.position`,
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
