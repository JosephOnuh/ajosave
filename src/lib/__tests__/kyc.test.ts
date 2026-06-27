/**
 * @jest-environment node
 */

import { handleKycWebhook } from "../kyc";
import { query } from "../db";
import * as crypto from "crypto";

jest.mock("../db", () => ({
  query: jest.fn(),
}));

// Mock env variables required by kyc.ts
process.env.SMILE_API_KEY = "test-api-key";
process.env.SMILE_PARTNER_ID = "test-partner-id";
process.env.SMILE_CALLBACK_URL = "http://localhost/callback";

describe("KYC webhook verification", () => {
  let timingSafeEqualSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    timingSafeEqualSpy = jest.spyOn(crypto, "timingSafeEqual");
  });

  afterEach(() => {
    timingSafeEqualSpy.mockRestore();
  });

  it("successfully verifies a valid Smile Identity webhook signature", async () => {
    const payload = {
      ResultCode: "1012",
      PartnerParams: { user_id: "user-123" },
      timestamp: "1620000000",
      signature: "", // will be calculated below
    };

    // Calculate expected valid signature
    const expectedSig = crypto
      .createHmac("sha256", "test-api-key")
      .update("1620000000:test-partner-id")
      .digest("base64");

    payload.signature = expectedSig;

    (query as jest.Mock).mockResolvedValue({ rows: [] });

    const result = await handleKycWebhook(payload);

    expect(result).toEqual({ userId: "user-123", status: "approved" });
    expect(timingSafeEqualSpy).toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE users\n     SET kyc_status = $1"),
      ["approved", "user-123"]
    );
  });

  it("throws an error when signatures have different lengths without calling timingSafeEqual", async () => {
    const payload = {
      ResultCode: "1012",
      PartnerParams: { user_id: "user-123" },
      timestamp: "1620000000",
      signature: "short-sig",
    };

    (query as jest.Mock).mockResolvedValue({ rows: [] });

    await expect(handleKycWebhook(payload)).rejects.toThrow(
      "Invalid Smile Identity webhook signature"
    );

    // Because lengths are different, timingSafeEqual should NOT be called.
    expect(timingSafeEqualSpy).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("calls timingSafeEqual but throws an error when signature has correct length but incorrect content", async () => {
    const payload = {
      ResultCode: "1012",
      PartnerParams: { user_id: "user-123" },
      timestamp: "1620000000",
      signature: "a".repeat(44), // base64 sha256 output is 44 chars
    };

    (query as jest.Mock).mockResolvedValue({ rows: [] });

    await expect(handleKycWebhook(payload)).rejects.toThrow(
      "Invalid Smile Identity webhook signature"
    );

    expect(timingSafeEqualSpy).toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
