import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserReputation, getReputationLevel } from "@/server/services/reputation.service";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse, ReputationScore } from "@/types";

// GET /api/v1/reputation — fetch current user's score
export const GET = withErrorHandler(async (_req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  const userId = (session.user as { id: string }).id;
  const score = await getUserReputation(userId);
  const level = getReputationLevel(score);

  return NextResponse.json<ApiResponse<ReputationScore>>({
    success: true,
    data: {
      score,
      level,
    },
  });
});

// POST /api/v1/reputation — sync reputation score with on-chain Soroban contract
export const POST = withErrorHandler(async (_req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = (session.user as { id: string }).id;
  
  // Retrieve user's stellar public key from DB
  const { query } = await import("@/lib/db");
  const { rows } = await query<{ stellar_public_key: string | null }>(
    "SELECT stellar_public_key FROM users WHERE id = $1",
    [userId]
  );
  
  const stellarAddress = rows[0]?.stellar_public_key;
  if (stellarAddress) {
    const { syncReputationToDb } = await import("@/lib/reputation");
    await syncReputationToDb(userId, stellarAddress);
  }
  
  const score = await getUserReputation(userId);
  const level = getReputationLevel(score);

  return NextResponse.json<ApiResponse<ReputationScore>>({
    success: true,
    data: {
      score,
      level,
    },
  });
});
