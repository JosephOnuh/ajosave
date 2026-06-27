import {
  sendPayoutReminders,
  processMissedContributions,
  sendContributionReminders,
  processDueCycles,
} from "@/server/services/scheduler.service";
import * as db from "@/lib/db";
import * as notificationService from "@/server/services/notification.service";
import * as contributionService from "@/server/services/contribution.service";
import * as payoutQueue from "@/lib/queue/payoutQueue";

jest.mock("@/lib/db", () => ({ query: jest.fn() }));
jest.mock("@/server/services/notification.service", () => ({
  notifyPayoutReminder: jest.fn().mockResolvedValue(undefined),
  notifyMissedContribution: jest.fn().mockResolvedValue(undefined),
  notifyContributionReminder: jest.fn().mockResolvedValue(undefined),
  notifyAdminOfDefault: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/server/services/contribution.service", () => ({
  getMissedContributions: jest.fn(),
}));
jest.mock("@/lib/queue/payoutQueue", () => ({
  addPayoutJob: jest.fn().mockResolvedValue(undefined),
}));

const mockQuery = db.query as jest.MockedFunction<typeof db.query>;
const mockNotifyPayoutReminder = notificationService.notifyPayoutReminder as jest.MockedFunction<
  typeof notificationService.notifyPayoutReminder
>;
const mockNotifyMissedContribution =
  notificationService.notifyMissedContribution as jest.MockedFunction<
    typeof notificationService.notifyMissedContribution
  >;
const mockNotifyContributionReminder =
  notificationService.notifyContributionReminder as jest.MockedFunction<
    typeof notificationService.notifyContributionReminder
  >;
const mockGetMissedContributions =
  contributionService.getMissedContributions as jest.MockedFunction<
    typeof contributionService.getMissedContributions
  >;
const mockAddPayoutJob = payoutQueue.addPayoutJob as jest.MockedFunction<
  typeof payoutQueue.addPayoutJob
>;

const CIRCLE_ID = "circle-1";

function makeCircle(overrides: Record<string, unknown> = {}) {
  return {
    id: CIRCLE_ID,
    name: "Test Circle",
    status: "active",
    currentCycle: 1,
    contributionUsdc: "10.0000000",
    nextPayoutAt: new Date(),
    gracePeriodHours: 24,
    creatorId: "user-creator",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── sendPayoutReminders ────────────────────────────────────────────────────

describe("sendPayoutReminders", () => {
  it("sends a reminder to the next payout recipient", async () => {
    const circle = makeCircle();
    mockQuery
      .mockResolvedValueOnce({ rows: [circle], rowCount: 1 } as any) // circles query
      .mockResolvedValueOnce({ rows: [{ id: "m1", userId: "u1" }], rowCount: 1 } as any) // members query
      .mockResolvedValueOnce({ rows: [{ count: 3 }], rowCount: 1 } as any); // count query

    await sendPayoutReminders();

    expect(mockNotifyPayoutReminder).toHaveBeenCalledWith("u1", circle.name, "30.0000000", 24);
  });

  it("skips circles with no eligible recipient at the current position", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [makeCircle()], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // no member at position
      .mockResolvedValueOnce({ rows: [{ count: 3 }], rowCount: 1 } as any);

    await sendPayoutReminders();

    expect(mockNotifyPayoutReminder).not.toHaveBeenCalled();
  });

  it("does nothing when no circles are due in 23-25h", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    await sendPayoutReminders();

    expect(mockNotifyPayoutReminder).not.toHaveBeenCalled();
  });

  it("logs error and continues when a reminder fails for one circle", async () => {
    const circles = [makeCircle({ id: "c1" }), makeCircle({ id: "c2" })];
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockQuery
      .mockResolvedValueOnce({ rows: circles, rowCount: 2 } as any)
      // c1: member query throws
      .mockRejectedValueOnce(new Error("DB error"))
      // c2: normal
      .mockResolvedValueOnce({ rows: [{ id: "m2", userId: "u2" }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ count: 2 }], rowCount: 1 } as any);

    await sendPayoutReminders();

    expect(consoleSpy).toHaveBeenCalled();
    expect(mockNotifyPayoutReminder).toHaveBeenCalledTimes(1);
    consoleSpy.mockRestore();
  });
});

// ─── processMissedContributions ─────────────────────────────────────────────

describe("processMissedContributions", () => {
  it("marks defaulted members, inserts missed contribution, and notifies", async () => {
    const circle = makeCircle({ penalty_percent: 10 });
    mockGetMissedContributions.mockResolvedValue([{ memberId: "m1", userId: "u1" }]);
    mockQuery
      .mockResolvedValueOnce({ rows: [circle], rowCount: 1 } as any) // circles
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // UPDATE members SET defaulted
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // INSERT contributions missed
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // UPDATE reputation
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // INSERT penalties

    await processMissedContributions();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE members SET status = 'defaulted'"),
      ["m1"]
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO contributions"),
      expect.arrayContaining(["m1", circle.contributionUsdc])
    );
    expect(mockNotifyMissedContribution).toHaveBeenCalledWith("u1", circle.name, circle.contributionUsdc);
  });

  it("does nothing when no circles have elapsed grace periods", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    await processMissedContributions();

    expect(mockGetMissedContributions).not.toHaveBeenCalled();
  });

  it("skips members when there are no missed contributions", async () => {
    mockGetMissedContributions.mockResolvedValue([]);
    mockQuery.mockResolvedValueOnce({ rows: [makeCircle()], rowCount: 1 } as any);

    await processMissedContributions();

    expect(mockNotifyMissedContribution).not.toHaveBeenCalled();
  });

  it("logs error and continues when processing a circle fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockQuery.mockResolvedValueOnce({ rows: [makeCircle({ id: "c1" }), makeCircle({ id: "c2" })], rowCount: 2 } as any);
    mockGetMissedContributions
      .mockRejectedValueOnce(new Error("DB error"))
      .mockResolvedValueOnce([]);

    await processMissedContributions();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ─── sendContributionReminders ───────────────────────────────────────────────

describe("sendContributionReminders", () => {
  function setupReminderQuery(
    circles: object[],
    members: object[],
    confirmedRows: object[],
    statusRows: object[],
    reminderRows: object[]
  ) {
    mockQuery
      .mockResolvedValueOnce({ rows: circles, rowCount: circles.length } as any) // circles (24h window)
      .mockResolvedValueOnce({ rows: members, rowCount: members.length } as any) // members
      .mockResolvedValueOnce({ rows: confirmedRows, rowCount: confirmedRows.length } as any) // confirmed check
      .mockResolvedValueOnce({ rows: statusRows, rowCount: statusRows.length } as any) // status check
      .mockResolvedValueOnce({ rows: reminderRows, rowCount: reminderRows.length } as any) // idempotency check
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // insert reminder record
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // circles (2h window) — empty
  }

  it("sends 24h reminder to pending contributors", async () => {
    const circle = makeCircle();
    const member = { id: "m1", userId: "u1" };

    setupReminderQuery([circle], [member], [], [], []);

    await sendContributionReminders();

    expect(mockNotifyContributionReminder).toHaveBeenCalledWith(
      "u1",
      circle.name,
      circle.contributionUsdc,
      24,
      CIRCLE_ID
    );
  });

  it("skips members who already confirmed their contribution", async () => {
    const circle = makeCircle();
    mockQuery
      .mockResolvedValueOnce({ rows: [circle], rowCount: 1 } as any) // 24h circles
      .mockResolvedValueOnce({ rows: [{ id: "m1", userId: "u1" }], rowCount: 1 } as any) // members
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }], rowCount: 1 } as any) // confirmed → skip
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // 2h circles

    await sendContributionReminders();

    expect(mockNotifyContributionReminder).not.toHaveBeenCalled();
  });

  it("skips members with a missed contribution status", async () => {
    const circle = makeCircle();
    mockQuery
      .mockResolvedValueOnce({ rows: [circle], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ id: "m1", userId: "u1" }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // not confirmed
      .mockResolvedValueOnce({ rows: [{ status: "missed" }], rowCount: 1 } as any) // missed → skip
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // 2h circles

    await sendContributionReminders();

    expect(mockNotifyContributionReminder).not.toHaveBeenCalled();
  });

  it("skips members who already received this reminder (idempotency)", async () => {
    const circle = makeCircle();
    mockQuery
      .mockResolvedValueOnce({ rows: [circle], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ id: "m1", userId: "u1" }], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // not confirmed
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // not missed
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }], rowCount: 1 } as any) // already reminded → skip
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // 2h circles

    await sendContributionReminders();

    expect(mockNotifyContributionReminder).not.toHaveBeenCalled();
  });

  it("does nothing when no circles fall in either reminder window", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // 24h circles
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // 2h circles

    await sendContributionReminders();

    expect(mockNotifyContributionReminder).not.toHaveBeenCalled();
  });

  it("logs error and continues when a circle fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockQuery
      .mockResolvedValueOnce({ rows: [makeCircle()], rowCount: 1 } as any) // 24h circles
      .mockRejectedValueOnce(new Error("DB error")) // members query throws
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // 2h circles

    await sendContributionReminders();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ─── processDueCycles ────────────────────────────────────────────────────────

describe("processDueCycles", () => {
  it("enqueues a payout job for a due circle with all contributions confirmed", async () => {
    const circle = { id: CIRCLE_ID, currentCycle: 1 };
    mockQuery
      .mockResolvedValueOnce({ rows: [circle], rowCount: 1 } as any) // due circles
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // no existing payout
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any); // no unpaid members

    await processDueCycles();

    expect(mockAddPayoutJob).toHaveBeenCalledWith(CIRCLE_ID, 1);
  });

  it("skips circles that already have a payout record for the current cycle", async () => {
    const circle = { id: CIRCLE_ID, currentCycle: 2 };
    mockQuery
      .mockResolvedValueOnce({ rows: [circle], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [{ "?column?": 1 }], rowCount: 1 } as any); // existing payout

    await processDueCycles();

    expect(mockAddPayoutJob).not.toHaveBeenCalled();
  });

  it("skips circles where members have not fully contributed", async () => {
    const circle = { id: CIRCLE_ID, currentCycle: 1 };
    mockQuery
      .mockResolvedValueOnce({ rows: [circle], rowCount: 1 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // no existing payout
      .mockResolvedValueOnce({ rows: [{ id: "m1" }], rowCount: 1 } as any); // 1 unpaid member

    await processDueCycles();

    expect(mockAddPayoutJob).not.toHaveBeenCalled();
  });

  it("does nothing when no circles are due", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    await processDueCycles();

    expect(mockAddPayoutJob).not.toHaveBeenCalled();
  });

  it("logs error and continues when enqueueing fails for one circle", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const circles = [
      { id: "c1", currentCycle: 1 },
      { id: "c2", currentCycle: 1 },
    ];
    mockQuery
      .mockResolvedValueOnce({ rows: circles, rowCount: 2 } as any)
      // c1: no existing, no unpaid → enqueue (throws)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      // c2: no existing, no unpaid → enqueue (succeeds)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any);

    mockAddPayoutJob
      .mockRejectedValueOnce(new Error("Queue error"))
      .mockResolvedValueOnce(undefined);

    await processDueCycles();

    expect(consoleSpy).toHaveBeenCalled();
    expect(mockAddPayoutJob).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });
});
