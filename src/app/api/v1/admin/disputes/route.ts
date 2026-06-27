import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import {
  getAllDisputes,
  resolveDispute,
  updateDisputeStatus,
  confirmContributionFromDispute,
  notifyDisputeParties,
} from "@/server/services/dispute.service";
import { logAuditAction } from "@/server/services/audit.service";
import type { ApiResponse, Dispute } from "@/types";
import { z } from "zod";

const ResolveSchema = z.object({
  disputeId: z.string().uuid(),
  status: z.enum(["investigating", "resolved", "rejected"]),
  resolutionNotes: z.string().min(5).max(500).optional(),
  txHash: z.string().optional(),
  contributionId: z.string().uuid().optional(),
});

export const GET = withErrorHandler(
  withAdminAuth(async () => {
    const disputes = await getAllDisputes();
    return NextResponse.json<ApiResponse<Dispute[]>>({ success: true, data: disputes });
  })
);

export const POST = withErrorHandler(
  withAdminAuth(async (req: NextRequest) => {
    const session = await getServerSession(authOptions);
    const adminId = (session?.user as { id: string }).id;
    const body = await req.json();
    const parsed = ResolveSchema.parse(body);

    const dispute =
      parsed.status === "investigating"
        ? await updateDisputeStatus(parsed.disputeId, "investigating")
        : await resolveDispute(
            parsed.disputeId,
            parsed.status,
            parsed.resolutionNotes ?? "",
            adminId
          );

    if (parsed.status === "resolved" && parsed.txHash && parsed.contributionId) {
      await confirmContributionFromDispute(parsed.disputeId, parsed.contributionId, parsed.txHash);
    }

    // Notify the member when resolved or rejected
    if (parsed.status === "resolved" || parsed.status === "rejected") {
      notifyDisputeParties(parsed.disputeId, parsed.status, parsed.resolutionNotes).catch(
        (err) => console.error("[disputes] notify parties failed:", err)
      );
    }

    await logAuditAction(adminId, "OTHER", "OTHER", parsed.disputeId, {
      details: { action: `dispute_${parsed.status}`, notes: parsed.resolutionNotes },
    });

    return NextResponse.json<ApiResponse<Dispute>>({ success: true, data: dispute });
  })
);
