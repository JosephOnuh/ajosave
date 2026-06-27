/**
 * @jest-environment node
 *
 * Tests that withIdempotency is applied to the contribute POST handler.
 * The real withIdempotency implementation is used; Redis is mocked.
 */
import { NextRequest } from "next/server";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/server/services/circle.service");
jest.mock("@/lib/paystack");
jest.mock("@/lib/db");
jest.mock("@/server/config", () => ({
  serverConfig: {
    app: { url: "http://localhost:3000" },
    paystack: { secretKey: "test" },
    stellar: { network: "testnet", sorobanRpcUrl: "http://localhost", ajoContractId: "test" },
  },
}));

// Mock Redis used by withIdempotency
const mockGet = jest.fn();
const mockSet = jest.fn();
jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn().mockResolvedValue({ get: mockGet, set: mockSet }),
}));

import { POST } from "@/app/api/circles/[id]/contribute/route";
import { getServerSession } from "next-auth";
import { getCircleById, getMembersByCircle } from "@/server/services/circle.service";
import { initializePayment } from "@/lib/paystack";
import * as db from "@/lib/db";

const mockSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockGetCircle = getCircleById as jest.MockedFunction<typeof getCircleById>;
const mockGetMembers = getMembersByCircle as jest.MockedFunction<typeof getMembersByCircle>;
const mockInitPayment = initializePayment as jest.MockedFunction<typeof initializePayment>;
const mockQuery = db.query as jest.MockedFunction<typeof db.query>;

const CIRCLE_ID = "circle-1";
const MEMBER_ID = "member-1";
const USER_ID = "user-1";
const CYCLE = 2;
const IDEMPOTENCY_KEY = "test-key-abc123";

const circle = {
  id: CIRCLE_ID,
  status: "active",
  currentCycle: CYCLE,
  contributionFiat: 5000,
  contributionCurrency: "NGN",
  contributionUsdc: "3.0000000",
} as any;

const member = { id: MEMBER_ID, userId: USER_ID } as any;

function makeRequest(idempotencyKey?: string) {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;
  return new NextRequest(`http://localhost/api/circles/${CIRCLE_ID}/contribute`, {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSession.mockResolvedValue({ user: { id: USER_ID, email: "user@test.com" } } as any);
  mockGetCircle.mockResolvedValue(circle);
  mockGetMembers.mockResolvedValue([member]);
});

describe("withIdempotency on contribute route", () => {
  it("second call with same Idempotency-Key returns cached response without re-initiating payment", async () => {
    const cachedBody = { success: true, data: { authorizationUrl: "https://paystack.com/pay/cached", reference: "ref-1", platformFee: 0 } };
    // Redis has a cached entry for this key
    mockGet.mockResolvedValueOnce(JSON.stringify({ status: 200, body: cachedBody }));

    const res = await POST(makeRequest(IDEMPOTENCY_KEY), { params: { id: CIRCLE_ID } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(cachedBody);
    // Payment should NOT have been initialized again
    expect(mockInitPayment).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("first call with Idempotency-Key caches the response in Redis", async () => {
    const authUrl = "https://paystack.com/pay/new";
    mockGet.mockResolvedValueOnce(null); // no cache
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // no pending
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // upsert
    mockInitPayment.mockResolvedValue({
      authorizationUrl: authUrl,
      reference: `ajo-${CIRCLE_ID}-${MEMBER_ID}-${CYCLE}`,
      platformFee: 0,
    });

    const res = await POST(makeRequest(IDEMPOTENCY_KEY), { params: { id: CIRCLE_ID } });

    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith(
      `idempotency:${IDEMPOTENCY_KEY}`,
      expect.stringContaining(authUrl),
      expect.objectContaining({ EX: expect.any(Number) })
    );
  });
});
