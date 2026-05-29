import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { leaveCircle } from "@/server/services/circle.service";
import { withErrorHandler } from "@/server/middleware";

export const POST = withErrorHandler(
  async (req: NextRequest, ctx: unknown) => {
    const session = await getServerSession(authOptions);
    const user = session?.user as { id: string } | undefined;
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { params } = ctx as { params: { id: string } };
    const circleId = params.id;
    await leaveCircle(circleId, user.id);

    return NextResponse.json({
      success: true,
      message: "Successfully left the circle",
    });
  }
);
