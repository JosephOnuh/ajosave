import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import {
  resolveDispute,
  updateDisputeStatus,
  notifyDisputeParties,
} from "@/server/services/dispute.service";
import { logAuditAction } from "@/server/services/audit.service";
import type { ApiResponse, Dispute } from "@/types";
import { z } from "zod";

const PatchSchema = z.object({
  status: z.enum(["investigating", "resolved", "rejected"]),
  resolutionNotes: z.string().min(5).max(500).optional(),
});

export const PATCH = withErrorHandler(
  withAdminAuth(async (req: NextRequest, ctx: unknown) => {
    const { params } = ctx as { params: { id: string } };
    const session = await getServerSession(authOptions);
    const adminId = (session?.user as { id: string }).id;
    const body = await req.json();
    const { status, resolutionNotes } = PatchSchema.parse(body);

    const dispute =
      status === "investigating"
        ? await updateDisputeStatus(params.id, "investigating")
        : await resolveDispute(params.id, status, resolutionNotes ?? "", adminId);

    if (status === "resolved" || status === "rejected") {
      notifyDisputeParties(params.id, status, resolutionNotes).catch(
        (err) => console.error("[disputes] notify parties failed:", err)
      );
    }

    await logAuditAction(adminId, "OTHER", "OTHER", params.id, {
      details: { action: `dispute_${status}`, notes: resolutionNotes },
    });

    return NextResponse.json<ApiResponse<Dispute>>({ success: true, data: dispute });
  })
);
