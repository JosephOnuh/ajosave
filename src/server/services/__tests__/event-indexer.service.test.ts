/**
 * Unit tests for event-indexer.service.ts reactive handlers.
 * Each test verifies the correct DB update is issued for a given contract event topic.
 */
import { pollOnce } from "@/server/services/event-indexer.service";
import * as db from "@/lib/db";
import * as soroban from "@/lib/soroban";

jest.mock("@/lib/db", () => ({
  query: jest.fn(),
}));
jest.mock("@/lib/soroban", () => ({
  getContractEvents: jest.fn(),
}));
jest.mock("@/server/config", () => ({
  serverConfig: {
    stellar: {
      ajoContractId: "CTEST_CONTRACT",
      network: "testnet",
      sorobanRpcUrl: "https://soroban-testnet.stellar.org",
    },
  },
}));
jest.mock("@/server/services/reputation.service", () => ({
  incrementReputationOnContribution: jest.fn().mockResolvedValue(undefined),
}));

const mockQuery = db.query as jest.MockedFunction<typeof db.query>;
const mockGetContractEvents = soroban.getContractEvents as jest.MockedFunction<
  typeof soroban.getContractEvents
>;

const CIRCLE_ID = "circle-abc";
const MEMBER_ADDRESS = "GDNIKPB2TPPS2RZG6TDW76YFSPNVEINVTJIPVEPA25Y74TPSLBNOA336";
const TX_HASH = "txhash123";

function makeEvent(topic: string, value: Record<string, unknown>) {
  return {
    topic: [topic],
    value,
    ledger: 100,
    timestamp: 1700000000,
    transactionHash: TX_HASH,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: indexer_state returns ledger 0; storeEvent inserts successfully (rowCount=1)
  mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);
});

describe("event-indexer reactToEvent", () => {
  it("member_joined: updates member status to active via stellar address", async () => {
    mockGetContractEvents.mockResolvedValue([
      makeEvent("member_joined", { circle_id: CIRCLE_ID, member_address: MEMBER_ADDRESS }),
    ]);

    await pollOnce();

    const updateCall = mockQuery.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("status = 'active'") && sql.includes("stellar_public_key")
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).toEqual(expect.arrayContaining([CIRCLE_ID, MEMBER_ADDRESS]));
  });

  it("contribution_made: marks matching pending contribution as confirmed", async () => {
    mockGetContractEvents.mockResolvedValue([
      makeEvent("contribution_made", { circle_id: CIRCLE_ID, cycle: 1, amount: "10.0000000" }),
    ]);
    // storeEvent inserts, then onContributionMade returns a confirmed row
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // getLastIndexedLedger
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // storeEvent INSERT
      .mockResolvedValueOnce({ rows: [{ id: "contrib-1", user_id: "user-1" }], rowCount: 1 } as any) // onContributionMade UPDATE
      .mockResolvedValue({ rows: [], rowCount: 0 } as any); // markProcessed + saveCheckpoint

    await pollOnce();

    const confirmCall = mockQuery.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("status = 'confirmed'")
    );
    expect(confirmCall).toBeDefined();
    expect(confirmCall![1]).toEqual(expect.arrayContaining([TX_HASH]));
  });

  it("payout_sent: inserts payout record and marks member as received", async () => {
    const MEMBER_ID = "member-99";
    mockGetContractEvents.mockResolvedValue([
      makeEvent("payout_sent", {
        circle_id: CIRCLE_ID,
        recipient_address: MEMBER_ADDRESS,
        amount: "30.0000000",
        cycle: 2,
      }),
    ]);
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as any) // getLastIndexedLedger
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // storeEvent INSERT
      .mockResolvedValueOnce({ rows: [{ id: MEMBER_ID }], rowCount: 1 } as any) // SELECT member by stellar address
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // INSERT payouts
      .mockResolvedValue({ rows: [], rowCount: 1 } as any); // UPDATE members + markProcessed + saveCheckpoint

    await pollOnce();

    const insertPayoutCall = mockQuery.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO payouts")
    );
    expect(insertPayoutCall).toBeDefined();

    const markReceivedCall = mockQuery.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("has_received_payout = true")
    );
    expect(markReceivedCall).toBeDefined();
    expect(markReceivedCall![1]).toEqual([MEMBER_ID]);
  });

  it("circle_completed: sets circle status to completed", async () => {
    mockGetContractEvents.mockResolvedValue([
      makeEvent("circle_completed", { circle_id: CIRCLE_ID }),
    ]);

    await pollOnce();

    const updateCall = mockQuery.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("status = 'completed'") && sql.includes("circles")
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).toEqual(expect.arrayContaining([CIRCLE_ID]));
  });

  it("member_defaulted: sets member status to defaulted via stellar address", async () => {
    mockGetContractEvents.mockResolvedValue([
      makeEvent("member_defaulted", { circle_id: CIRCLE_ID, member_address: MEMBER_ADDRESS }),
    ]);

    await pollOnce();

    const updateCall = mockQuery.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("status = 'defaulted'")
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).toEqual(expect.arrayContaining([CIRCLE_ID, MEMBER_ADDRESS]));
  });

  it("skips handler but stores event when value is missing required fields", async () => {
    mockGetContractEvents.mockResolvedValue([
      makeEvent("circle_completed", {}), // no circle_id
    ]);

    await pollOnce();

    // storeEvent is called but the UPDATE circles query is NOT called
    const updateCircleCall = mockQuery.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("UPDATE circles SET status = 'completed'")
    );
    expect(updateCircleCall).toBeUndefined();
  });
});
