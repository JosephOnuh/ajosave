import { NextRequest, NextResponse } from "next/server";
import { sendOtp } from "@/lib/sms";
import { rateLimit, withErrorHandler } from "@/server/middleware";
import type { ApiResponse } from "@/types";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const { phone } = await req.json();
  if (!phone || !/^\+?[1-9]\d{9,14}$/.test(phone)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Invalid phone number" },
      { status: 400 }
    );
  }
  if (!rateLimit(`otp:${phone}`, 3, 10 * 60 * 1000)) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Too many requests. Please wait before requesting another OTP." },
      { status: 429 }
    );
  }
  const otp = await sendOtp(phone);
  if (process.env.NODE_ENV === "development") console.warn(`[DEV] OTP for ${phone}: ${otp}`);
  return NextResponse.json<ApiResponse<{ message: string }>>({
    success: true,
    data: { message: "OTP sent successfully" },
  });
});
