import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import { approveEarlyExit } from "@/server/services/early-exit.service";
import { logAuditAction } from "@/server/services/audit.service";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import type { ApiResponse, EarlyExitRequest } from "@/types";

export const POST = withErrorHandler(
  withAdminAuth(async (_req: NextRequest, ctx: unknown) => {
    const { params } = ctx as { params: { id: string } };
    const session = await getServerSession(authOptions);
    const adminId = (session?.user as { id: string }).id;

    const result = await approveEarlyExit(params.id);

    // Notify member
    const { rows } = await query<{ email: string | null; displayName: string }>(
      `SELECT u.email, u.display_name AS "displayName"
       FROM users u WHERE u.id = $1`,
      [result.userId]
    );
    const user = rows[0];
    if (user?.email) {
      sendEmail({
        to: user.email,
        subject: "Early Exit Request Approved",
        html: `<p>Hi ${user.displayName}, your early exit request has been approved. A refund of <strong>${result.refundUsdc} USDC</strong> (after ${result.penaltyPercent}% penalty) has been sent to your Stellar wallet.</p>`,
      }).catch((err) => console.error("[early-exit] notify failed:", err));
    }

    await logAuditAction(adminId, "OTHER", "MEMBER", result.memberId, {
      details: {
        action: "early_exit_approved",
        refundUsdc: result.refundUsdc,
        penaltyUsdc: result.penaltyUsdc,
      },
    });

    return NextResponse.json<ApiResponse<EarlyExitRequest>>({ success: true, data: result });
  })
);
