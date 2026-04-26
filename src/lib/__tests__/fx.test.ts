import { getNgnPerUsdc } from "@/lib/fx";

jest.mock("axios");
jest.mock("@/lib/redis");

import axios from "axios";
import { getRedis } from "@/lib/redis";

const mockAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;
const mockGetRedis = getRedis as jest.MockedFunction<typeof getRedis>;

function makeRedis(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue("OK"),
    set: jest.fn().mockResolvedValue("OK"),
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe("getNgnPerUsdc", () => {
  it("returns cached rate when available", async () => {
    const redis = makeRedis({ get: jest.fn().mockResolvedValue("1750") });
    mockGetRedis.mockResolvedValue(redis as any);

    const rate = await getNgnPerUsdc();

    expect(rate).toBe(1750);
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it("fetches live rate, caches it, and returns it", async () => {
    const redis = makeRedis();
    mockGetRedis.mockResolvedValue(redis as any);
    mockAxiosGet.mockResolvedValue({ data: { rates: { NGN: 1620 } } } as any);

    const rate = await getNgnPerUsdc();

    expect(rate).toBe(1620);
    // Cached with 5-minute TTL
    expect(redis.setEx).toHaveBeenCalledWith("fx:ngn_per_usdc", 300, "1620");
    // Persisted as last-known fallback
    expect(redis.set).toHaveBeenCalledWith("fx:ngn_per_usdc:last_known", "1620");
  });

  it("falls back to last known rate when API fails", async () => {
    const redis = makeRedis({
      get: jest.fn()
        .mockResolvedValueOnce(null)           // cache miss
        .mockResolvedValueOnce("1580"),         // last known
    });
    mockGetRedis.mockResolvedValue(redis as any);
    mockAxiosGet.mockRejectedValue(new Error("Network error"));

    const rate = await getNgnPerUsdc();

    expect(rate).toBe(1580);
  });

  it("falls back to hardcoded 1600 when API fails and no last-known rate exists", async () => {
    const redis = makeRedis({ get: jest.fn().mockResolvedValue(null) });
    mockGetRedis.mockResolvedValue(redis as any);
    mockAxiosGet.mockRejectedValue(new Error("Network error"));

    const rate = await getNgnPerUsdc();

    expect(rate).toBe(1600);
  });

  it("throws when NGN rate is missing from API response", async () => {
    const redis = makeRedis();
    mockGetRedis.mockResolvedValue(redis as any);
    mockAxiosGet.mockResolvedValue({ data: { rates: {} } } as any);

    // Falls back to hardcoded since fetchLiveRate throws
    const rate = await getNgnPerUsdc();
    expect(rate).toBe(1600);
  });
});
