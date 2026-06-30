import { NextRequest, NextResponse } from "next/server";
import { adminListCircles, PaginatedResult } from "@/server/services/admin.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";
import type { AdminCircleRow } from "@/server/services/admin.service";

export const GET = withErrorHandler(
  withAdminAuth(async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    const result = await adminListCircles(includeDeleted, page, pageSize);
    return NextResponse.json<ApiResponse<PaginatedResult<AdminCircleRow>>>({ success: true, data: result });
  })
);
