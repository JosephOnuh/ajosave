/**
 * @jest-environment node
 */
import { POST } from "../route";
import { NextRequest } from "next/server";
import * as lockout from "@/lib/lockout";
import { getRedis } from "@/lib/redis";
import { hmacIndex } from "@/lib/encryption";

jest.mock("@/lib/lockout");
jest.mock("@/lib/redis");
jest.mock("@/lib/sms", () => ({ sendOtp: jest.fn().mockResolvedValue("123456") }));
jest.mock("@/server/middleware", () => ({
  withRateLimit: (handler: Function) => handler,
  withErrorHandler: (handler: Function) => handler,
  withSanitizedBody: (handler: Function) => handler,
}));

const TEST_HMAC_KEY = "b".repeat(64);
const PHONE = "+2348012345678";

beforeAll(() => {
  process.env.PII_HMAC_KEY = TEST_HMAC_KEY;
});
afterAll(() => {
  delete process.env.PII_HMAC_KEY;
});

describe("POST /api/auth/send-otp — Redis key format", () => {
  it("stores OTP under hmacIndex(phone), never the plaintext phone", async () => {
    (lockout.getLockoutStatus as jest.Mock).mockResolvedValue({
      isLocked: false,
      attempts: 0,
      remainingAttempts: 5,
    });

    const mockSet = jest.fn().mockResolvedValue("OK");
    (getRedis as jest.Mock).mockResolvedValue({ set: mockSet });

    const req = new NextRequest("http://localhost/api/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone: PHONE }),
    });

    await POST(req);

    expect(mockSet).toHaveBeenCalledTimes(1);
    const [usedKey] = mockSet.mock.calls[0];

    // Key must not contain the plaintext phone number
    expect(usedKey).not.toContain(PHONE);

    // Key must equal the expected hmac-based key
    expect(usedKey).toBe(`otp:${hmacIndex(PHONE)}`);
  });
});
