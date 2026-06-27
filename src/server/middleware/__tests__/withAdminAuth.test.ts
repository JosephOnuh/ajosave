jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/redis", () => ({ getRedis: jest.fn() }));
jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("next/server", () => ({
  NextRequest: class {},
  NextResponse: {
    json: jest.fn((body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
      headers: { set: jest.fn(), get: jest.fn() },
    })),
  },
}));

import { getServerSession } from "next-auth";
import { getRedis } from "@/lib/redis";
import { query as dbQueryFn } from "@/lib/db";
import { withAdminAuth } from "../index";

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;
const mockDbQuery = dbQueryFn as jest.MockedFunction<typeof dbQueryFn>;

function makeRedisMock(cachedRole: string | null) {
  return {
    get: jest.fn().mockResolvedValue(cachedRole),
    set: jest.fn().mockResolvedValue("OK"),
  };
}

function makeReq() {
  return {
    url: "http://localhost/api/admin/test",
    method: "GET",
    headers: { get: () => null },
  } as never;
}

const ADMIN_USER_ID = "user-admin-1";
const REGULAR_USER_ID = "user-regular-1";

const okHandler = jest.fn().mockResolvedValue({
  status: 200,
  body: { success: true },
  headers: { set: jest.fn() },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("withAdminAuth", () => {
  describe("unauthenticated requests", () => {
    it("returns 401 when no session exists", async () => {
      mockGetServerSession.mockResolvedValue(null);

      const res = await withAdminAuth(okHandler)(makeReq(), undefined);

      expect(res.status).toBe(401);
      expect(okHandler).not.toHaveBeenCalled();
    });

    it("returns 403 when session user has no id", async () => {
      mockGetServerSession.mockResolvedValue({ user: { email: "noid@x.com" } } as never);
      mockGetRedis.mockResolvedValue(makeRedisMock(null) as never);
      mockDbQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const res = await withAdminAuth(okHandler)(makeReq(), undefined);

      expect(res.status).toBe(403);
      expect(okHandler).not.toHaveBeenCalled();
    });
  });

  describe("DB-backed role check (Redis cache miss)", () => {
    it("allows request when DB role is 'admin'", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: ADMIN_USER_ID } } as never);
      const redis = makeRedisMock(null);
      mockGetRedis.mockResolvedValue(redis as never);
      mockDbQuery.mockResolvedValue({ rows: [{ role: "admin" }], rowCount: 1 } as never);

      const res = await withAdminAuth(okHandler)(makeReq(), undefined);

      expect(res.status).toBe(200);
      expect(mockDbQuery).toHaveBeenCalledWith(
        "SELECT role FROM users WHERE id = $1",
        [ADMIN_USER_ID]
      );
      // Role is cached for next request
      expect(redis.set).toHaveBeenCalledWith(
        `admin:role:${ADMIN_USER_ID}`,
        "admin",
        { EX: 60 }
      );
      expect(okHandler).toHaveBeenCalled();
    });

    it("returns 403 when DB role is not 'admin'", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: REGULAR_USER_ID } } as never);
      mockGetRedis.mockResolvedValue(makeRedisMock(null) as never);
      mockDbQuery.mockResolvedValue({ rows: [{ role: "user" }], rowCount: 1 } as never);

      const res = await withAdminAuth(okHandler)(makeReq(), undefined);

      expect(res.status).toBe(403);
      expect(okHandler).not.toHaveBeenCalled();
    });

    it("returns 403 when user is not found in DB", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: REGULAR_USER_ID } } as never);
      mockGetRedis.mockResolvedValue(makeRedisMock(null) as never);
      mockDbQuery.mockResolvedValue({ rows: [], rowCount: 0 } as never);

      const res = await withAdminAuth(okHandler)(makeReq(), undefined);

      expect(res.status).toBe(403);
      expect(okHandler).not.toHaveBeenCalled();
    });
  });

  describe("Redis cache hit (no DB query)", () => {
    it("allows request using cached 'admin' role without hitting DB", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: ADMIN_USER_ID } } as never);
      mockGetRedis.mockResolvedValue(makeRedisMock("admin") as never);

      const res = await withAdminAuth(okHandler)(makeReq(), undefined);

      expect(res.status).toBe(200);
      expect(mockDbQuery).not.toHaveBeenCalled();
      expect(okHandler).toHaveBeenCalled();
    });

    it("returns 403 using cached non-admin role without hitting DB", async () => {
      mockGetServerSession.mockResolvedValue({ user: { id: REGULAR_USER_ID } } as never);
      mockGetRedis.mockResolvedValue(makeRedisMock("user") as never);

      const res = await withAdminAuth(okHandler)(makeReq(), undefined);

      expect(res.status).toBe(403);
      expect(mockDbQuery).not.toHaveBeenCalled();
      expect(okHandler).not.toHaveBeenCalled();
    });

    it("returns 403 when cached role is empty string (revocation already propagated to cache)", async () => {
      // After a revoked admin's cache entry expires and is re-populated from DB,
      // the cache holds "" (empty string for non-admin).  Subsequent requests
      // within the new 60s TTL must be rejected without another DB query.
      mockGetServerSession.mockResolvedValue({ user: { id: ADMIN_USER_ID } } as never);
      mockGetRedis.mockResolvedValue(makeRedisMock("") as never);

      const res = await withAdminAuth(okHandler)(makeReq(), undefined);

      expect(res.status).toBe(403);
      expect(mockDbQuery).not.toHaveBeenCalled();
      expect(okHandler).not.toHaveBeenCalled();
    });
  });

  describe("revoked admin: rejection after cache TTL expires", () => {
    it("rejects a formerly-admin user once the 60s cache TTL expires and DB reflects revocation", async () => {
      // Sequence: admin granted → cache set to 'admin' for 60s → admin revoked in DB
      // → 60s pass (cache expires) → next request hits DB → returns 'user' → 403
      mockGetServerSession.mockResolvedValue({ user: { id: ADMIN_USER_ID } } as never);
      mockGetRedis.mockResolvedValue(makeRedisMock(null) as never); // TTL expired → miss
      mockDbQuery.mockResolvedValue({ rows: [{ role: "user" }], rowCount: 1 } as never);

      const res = await withAdminAuth(okHandler)(makeReq(), undefined);

      expect(res.status).toBe(403);
      expect(mockDbQuery).toHaveBeenCalledWith(
        "SELECT role FROM users WHERE id = $1",
        [ADMIN_USER_ID]
      );
      expect(okHandler).not.toHaveBeenCalled();
    });
  });
});
