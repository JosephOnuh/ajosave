import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCircleById, getMembersByCircle } from "@/server/services/circle.service";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse, Member } from "@/types";

/**
 * POST /api/circles/[id]/shuffle
 * Randomizes payout positions for an open circle (creator only).
 * In production this would persist to DB; here we return the shuffled order.
 */
export const POST = withErrorHandler(async (_req: NextRequest, ctx: unknown) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { params } = ctx as { params: { id: string } };
  const circle = await getCircleById(params.id);
  if (!circle) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Circle not found" },
      { status: 404 }
    );
  }

  const userId = (session.user as { id: string }).id;
  if (circle.creatorId !== userId) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Only the circle creator can shuffle positions" },
      { status: 403 }
    );
  }

  if (circle.status !== "open") {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Positions can only be shuffled before the circle starts" },
      { status: 400 }
    );
  }

  const circleMembers = await getMembersByCircle(params.id);
  // Fisher-Yates shuffle on positions
  const positions = circleMembers.map((_, i) => i + 1);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  const shuffled: Member[] = circleMembers.map((m, i) => ({ ...m, position: positions[i] }));
  shuffled.sort((a, b) => a.position - b.position);

  return NextResponse.json<ApiResponse<Member[]>>({ success: true, data: shuffled });
});
