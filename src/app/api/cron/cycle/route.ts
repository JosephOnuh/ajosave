import { NextRequest, NextResponse } from "next/server";
import { processDueCycles } from "@/server/services/scheduler.service";
import type { ApiResponse } from "@/types";

export const GET = async (req: NextRequest) => {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  await processDueCycles();
  return NextResponse.json<ApiResponse<{ message: string }>>({
    success: true,
    data: { message: "Cycle check complete" },
  });
};
