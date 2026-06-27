import type { Circle } from "@/types";

export const CIRCLE_SELECT = `
  id, name, creator_id as "creatorId",
  contribution_usdc as "contributionUsdc",
  contribution_fiat as "contributionFiat",
  contribution_currency as "contributionCurrency",
  circle_type as "circleType",
  max_members as "maxMembers",
  cycle_frequency as "cycleFrequency",
  payout_method as "payoutMethod",
  randomization_seed as "randomizationSeed",
  grace_period_hours as "gracePeriodHours",
  status, contract_id as "contractId",
  current_cycle as "currentCycle",
  (SELECT COUNT(*)::int FROM members WHERE circle_id = circles.id AND status = 'active') as "memberCount",
  next_payout_at as "nextPayoutAt",
  paused_at as "pausedAt",
  created_at as "createdAt",
  updated_at as "updatedAt",
  deleted_at as "deletedAt"
`;

export const MEMBER_SELECT = `
  m.id, m.circle_id as "circleId", m.user_id as "userId",
  u.display_name as "displayName",
  m.position, m.status, m.has_received_payout as "hasReceivedPayout",
  m.joined_at as "joinedAt", m.reviewed_at as "reviewedAt"
`;

export function computeNextPayoutDate(frequency: Circle["cycleFrequency"]): Date {
  const d = new Date();
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

export function createSeededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return function () {
    hash = (hash * 9301 + 49297) % 233280;
    return hash / 233280;
  };
}
