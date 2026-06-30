/**
 * Unit tests for audit.service.ts — Issue #534
 *
 * The DB layer is mocked so tests run without a database connection.
 */

jest.mock("@/lib/db", () => ({ query: jest.fn() }));

import { query } from "@/lib/db";
import {
  logAuditAction,
  getAuditLogs,
  getAuditLogsByActor,
  getAuditLogsByTarget,
  getAuditLogsByAction,
  getAuditLogCount,
} from "../audit.service";

const mockQuery = query as jest.Mock;

beforeEach(() => jest.clearAllMocks());

const SAMPLE_ROW = {
  id: "audit-1",
  actor_id: "admin-1",
  action: "TRIGGER_PAYOUT" as const,
  target_type: "CIRCLE" as const,
  target_id: "circle-1",
  details: { amount: 5000 },
  ip_address: "127.0.0.1",
  user_agent: "test",
  created_at: new Date("2025-01-01T00:00:00Z"),
};

describe("logAuditAction", () => {
  it("inserts a row and returns the created audit log", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });

    const result = await logAuditAction(
      "admin-1",
      "TRIGGER_PAYOUT",
      "CIRCLE",
      "circle-1",
      { details: { amount: 5000 }, ipAddress: "127.0.0.1", userAgent: "test" }
    );

    expect(result).toMatchObject({
      id: "audit-1",
      actor_id: "admin-1",
      action: "TRIGGER_PAYOUT",
      target_type: "CIRCLE",
      target_id: "circle-1",
    });
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO audit_logs/i);
    expect(params).toContain("admin-1");
    expect(params).toContain("TRIGGER_PAYOUT");
  });

  it("passes null for optional fields when not provided", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });

    await logAuditAction("admin-1", "OTHER", "OTHER", "target-1");

    const [, params] = mockQuery.mock.calls[0];
    // details, ipAddress, userAgent should all be null
    expect(params[4]).toBeNull();
    expect(params[5]).toBeNull();
    expect(params[6]).toBeNull();
  });
});

describe("getAuditLogs", () => {
  const MAPPED = {
    id: "audit-1",
    actorId: "admin-1",
    action: "TRIGGER_PAYOUT",
    targetType: "CIRCLE",
    targetId: "circle-1",
    details: { amount: 5000 },
    ipAddress: "127.0.0.1",
    userAgent: "test",
    createdAt: SAMPLE_ROW.created_at,
  };

  it("maps snake_case DB rows to camelCase response objects", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });

    const result = await getAuditLogs();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject(MAPPED);
  });

  it("returns an empty array when no rows match", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getAuditLogs({ actorId: "nobody" });

    expect(result).toEqual([]);
  });

  it("applies actorId filter in the SQL params", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await getAuditLogs({ actorId: "admin-99" });

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/actor_id/);
    expect(params).toContain("admin-99");
  });

  it("applies targetId filter in the SQL params", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await getAuditLogs({ targetId: "circle-99" });

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/target_id/);
    expect(params).toContain("circle-99");
  });
});

describe("getAuditLogsByActor", () => {
  it("delegates to getAuditLogs with the correct actorId", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });

    const result = await getAuditLogsByActor("admin-1");

    expect(result).toHaveLength(1);
    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain("admin-1");
  });
});

describe("getAuditLogsByTarget", () => {
  it("delegates to getAuditLogs with targetType and targetId", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });

    await getAuditLogsByTarget("CIRCLE", "circle-1");

    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain("CIRCLE");
    expect(params).toContain("circle-1");
  });
});

describe("getAuditLogsByAction", () => {
  it("delegates to getAuditLogs with the correct action", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [SAMPLE_ROW] });

    await getAuditLogsByAction("DELETE_USER");

    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain("DELETE_USER");
  });
});

describe("getAuditLogCount", () => {
  it("returns the count from the DB", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 42 }] });

    const count = await getAuditLogCount();

    expect(count).toBe(42);
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/COUNT/i);
  });

  it("returns 0 when the query returns no rows", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const count = await getAuditLogCount();

    expect(count).toBe(0);
  });

  it("filters by actorId when provided", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ count: 3 }] });

    await getAuditLogCount({ actorId: "admin-5" });

    const [, params] = mockQuery.mock.calls[0];
    expect(params).toContain("admin-5");
  });
});
