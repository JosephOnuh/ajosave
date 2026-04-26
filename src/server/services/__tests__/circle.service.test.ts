import { createCircle } from "@/server/services/circle.service";
import * as db from "@/lib/db";
import * as soroban from "@/lib/soroban";
import * as fx from "@/lib/fx";

jest.mock("@/lib/db");
jest.mock("@/lib/soroban");
jest.mock("@/lib/fx");

const mockQuery = db.query as jest.MockedFunction<typeof db.query>;
const mockDeployAjoContract = soroban.deployAjoContract as jest.MockedFunction<typeof soroban.deployAjoContract>;
const mockGetNgnPerUsdc = fx.getNgnPerUsdc as jest.MockedFunction<typeof fx.getNgnPerUsdc>;

const INPUT = {
  name: "Test Circle",
  contributionNgn: 16000,
  maxMembers: 5,
  cycleFrequency: "monthly" as const,
  payoutMethod: "fixed" as const,
};

const CIRCLE_ROW = {
  id: "circle-1",
  name: "Test Circle",
  creatorId: "user-1",
  contributionUsdc: "10.0000000",
  contributionNgn: 16000,
  maxMembers: 5,
  cycleFrequency: "monthly",
  payoutMethod: "fixed",
  contractId: "CDEPLOYEDCONTRACTID",
  status: "open",
  currentCycle: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetNgnPerUsdc.mockResolvedValue(1600);
});

describe("createCircle", () => {
  it("deploys a contract and stores contractId in the circle record", async () => {
    mockDeployAjoContract.mockResolvedValue("CDEPLOYEDCONTRACTID");
    mockQuery.mockResolvedValue({ rows: [CIRCLE_ROW], rowCount: 1 } as any);

    const circle = await createCircle("user-1", INPUT);

    expect(mockDeployAjoContract).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO circles"),
      expect.arrayContaining(["CDEPLOYEDCONTRACTID"])
    );
    expect(circle.contractId).toBe("CDEPLOYEDCONTRACTID");
  });

  it("creates circle with null contractId when deployment fails", async () => {
    mockDeployAjoContract.mockRejectedValue(new Error("WASM not found"));
    mockQuery.mockResolvedValue({
      rows: [{ ...CIRCLE_ROW, contractId: null }],
      rowCount: 1,
    } as any);

    const circle = await createCircle("user-1", INPUT);

    // Circle is still created even if deployment fails
    expect(circle).toBeDefined();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO circles"),
      expect.arrayContaining([null])
    );
  });
});
