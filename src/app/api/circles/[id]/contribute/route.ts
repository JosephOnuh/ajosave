import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCircleById, getMembersByCircle } from "@/server/services/circle.service";
import { initializePayment, ngnToKobo } from "@/lib/paystack";
import { serverConfig } from "@/server/config";
import { withErrorHandler } from "@/server/middleware";
import { randomUUID } from "crypto";
import type { ApiResponse } from "@/types";

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
  if (circle.status !== "active") {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Circle is not active" },
      { status: 400 }
    );
  }

  const circleMembers = await getMembersByCircle(params.id);
  const userId = (session.user as { id: string; email?: string }).id;
  const member = circleMembers.find((m) => m.userId === userId);
  if (!member) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "You are not a member of this circle" },
      { status: 403 }
    );
  }

  const reference = `ajo-${params.id}-${circle.currentCycle}-${randomUUID().slice(0, 8)}`;
  const callbackUrl = `${serverConfig.app.url}/circles/${params.id}/contribute/callback?reference=${reference}`;

  const { authorizationUrl } = await initializePayment({
    email: (session.user as { email?: string }).email ?? `${userId}@ajosave.app`,
    amountKobo: ngnToKobo(circle.contributionNgn),
    reference,
    callbackUrl,
    metadata: {
      circleId: params.id,
      memberId: member.id,
      cycleNumber: circle.currentCycle,
    },
  });

  return NextResponse.json<ApiResponse<{ authorizationUrl: string; reference: string }>>({
    success: true,
    data: { authorizationUrl, reference },
  });
});
