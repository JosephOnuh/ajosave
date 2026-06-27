jest.mock("next/server", () => ({
  NextRequest: class {},
  NextResponse: {
    json: jest.fn((body, init) => ({ status: init?.status ?? 200, json: async () => body, headers: { set: jest.fn(), get: jest.fn() } })),
  },
}));
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/encryption", () => ({ hmacIndex: jest.fn((v: string) => `hmac:${v}`) }));
jest.mock("@/lib/lockout", () => ({
  getLockoutStatus: jest.fn().mockResolvedValue({ isLocked: false, attempts: 0, remainingAttempts: 5 }),
  recordFailure: jest.fn().mockResolvedValue({ isLocked: false, attempts: 1, remainingAttempts: 4 }),
  resetLockout: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/db", () => ({
  query: jest.fn().mockResolvedValue({
    rows: [{ id: "u1", phone: "+2348012345678", display_name: "Test", role: "user" }],
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

  it("looks up OTP under hmac key, never plaintext phone", async () => {
    const phone = "+2348012345678";
    const mockGet = jest.fn().mockResolvedValue("123456");
    const mockDel = jest.fn().mockResolvedValue(1);
    const { getRedis } = require("@/lib/redis");
    getRedis.mockResolvedValueOnce({ get: mockGet, del: mockDel });
    await POST(makeReq({ phone, otp: "123456" }) as any);
    expect(mockGet).toHaveBeenCalledTimes(1);
    const [getKey] = mockGet.mock.calls[0];
    expect(getKey).toMatch(/^otp:/);
    expect(getKey).not.toContain(phone);
    const [delKey] = mockDel.mock.calls[0];
    expect(delKey).toMatch(/^otp:/);
    expect(delKey).not.toContain(phone);
  });
});
