import { NextRequest, NextResponse } from "next/server";
import { verifyPayment } from "@/lib/paystack";
import { withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Missing reference" },
      { status: 400 }
    );
  }

  const result = await verifyPayment(reference);
  return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
});
