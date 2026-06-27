import { NextResponse } from "next/server";
import { withAdminAuth, withErrorHandler } from "@/server/middleware";
import { getPendingEarlyExits } from "@/server/services/early-exit.service";
import type { ApiResponse, EarlyExitRequest } from "@/types";

export const GET = withErrorHandler(
  withAdminAuth(async () => {
    const requests = await getPendingEarlyExits();
    return NextResponse.json<ApiResponse<EarlyExitRequest[]>>({ success: true, data: requests });
  })
);
