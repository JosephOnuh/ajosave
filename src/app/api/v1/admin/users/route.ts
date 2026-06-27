import { NextRequest, NextResponse } from "next/server";
import { adminListUsers, PaginatedResult } from "@/server/services/admin.service";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

export const GET = withErrorHandler(
  withAdminAuth(async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
    const search = searchParams.get("search") ?? undefined;

    const result = await adminListUsers(search, page, pageSize);
    return NextResponse.json<ApiResponse<PaginatedResult<any>>>({ success: true, data: result });
  })
);
