jest.mock("next/server", () => ({
  NextRequest: class {},
  NextResponse: {
    json: jest.fn((body, init) => ({ status: init?.status ?? 200, json: async () => body, headers: { set: jest.fn(), get: jest.fn() } })),
  },
}));
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/encryption", () => ({
  encrypt: (v: string) => `enc-${v}`,
  hmacIndex: (v: string) => `hmac-${v}`,
  decrypt: (v: string) => v.startsWith("enc-") ? v.replace(/^enc-/, "") : v,
}));
jest.mock("@/lib/lockout", () => ({
  getLockoutStatus: jest.fn().mockResolvedValue({ isLocked: false, attempts: 0, remainingAttempts: 5 }),
  recordFailure: jest.fn().mockResolvedValue({ isLocked: false, attempts: 1, remainingAttempts: 4 }),
  resetLockout: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/db", () => ({
  query: jest.fn().mockImplementation(async (text: string, params: any[]) => {
    // Simulate SELECT by phone_hash
    if (text.includes("WHERE phone_hash = $1")) {
      if (params && params[0] === "hmac-+2348012345678") {
        return { rows: [{ id: "u1", phone: "enc-+2348012345678", display_name: "Test", role: "user" }] };
      }
      return { rows: [] };
    }

    // Simulate INSERT returning created user
    if (text.trim().startsWith("INSERT INTO users")) {
      return { rows: [{ id: "u2", phone: params?.[0] ?? "", display_name: "Ajosave User", role: "user" }] };
    }

    return { rows: [] };
  }),
}));
jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue("123456"),
    del: jest.fn().mockResolvedValue(1),
  }),
}));
jest.mock("@/server/middleware", () => ({
  withErrorHandler: (handler: Function) => handler,
  withRateLimit: (handler: Function) => handler,
}));
jest.mock("@/server/config", () => ({ serverConfig: { redis: { url: "redis://localhost" } } }));
jest.mock("@/lib/correlation", () => ({ runWithCorrelationId: (_id: string, fn: Function) => fn() }));
jest.mock("@/lib/logger", () => ({ child: () => ({ info: jest.fn(), error: jest.fn() }) }));

import { POST } from "../route";

const makeReq = (body: object) => ({
  json: async () => body,
  url: "http://localhost/api/v1/auth/verify-otp",
  method: "POST",
  headers: { get: () => null },
});

describe("POST /api/v1/auth/verify-otp — rate limiting", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 400 for missing otp", async () => {
    const res = await POST(makeReq({ phone: "+2348012345678" }) as any);
    expect(res.status).toBe(400);
  });

  it("returns 200 for valid OTP", async () => {
    const res = await POST(makeReq({ phone: "+2348012345678", otp: "123456" }) as any);
    expect(res.status).toBe(200);
  });

  it("returns 401 for wrong OTP", async () => {
    const { getRedis } = require("@/lib/redis");
    getRedis.mockResolvedValueOnce({ get: jest.fn().mockResolvedValue(null), del: jest.fn() });
    const res = await POST(makeReq({ phone: "+2348012345678", otp: "000000" }) as any);
    expect(res.status).toBe(401);
  });
});
