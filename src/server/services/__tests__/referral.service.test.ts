/**
 * Unit tests for referral.service.ts — Issue #534
 *
 * The service uses in-memory Maps, so no DB mocking is needed.
 * Each test uses unique userId prefixes to avoid cross-test state collisions.
 */

import {
  getReferralCode,
  trackReferral,
  getReferralsByUser,
  getReferralCount,
} from "../referral.service";

describe("getReferralCode", () => {
  it("returns a non-empty code for a user", () => {
    const code = getReferralCode("user-ref-001");
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(0);
  });

  it("returns the same code on repeated calls for the same user", () => {
    const first = getReferralCode("user-ref-002");
    const second = getReferralCode("user-ref-002");
    expect(first).toBe(second);
  });

  it("returns different codes for different users", () => {
    const codeA = getReferralCode("user-ref-003");
    const codeB = getReferralCode("user-ref-004");
    expect(codeA).not.toBe(codeB);
  });
});

describe("trackReferral", () => {
  it("records a referral and returns a referral object", () => {
    const referrerId = "user-ref-010";
    const referredId = "user-ref-011";
    const code = getReferralCode(referrerId);

    const result = trackReferral(code, referredId);

    expect(result).not.toBeNull();
    expect(result!.referrerId).toBe(referrerId);
    expect(result!.referredUserId).toBe(referredId);
    expect(result!.code).toBe(code);
    expect(result!.id).toBeTruthy();
    expect(result!.createdAt).toBeInstanceOf(Date);
  });

  it("returns null for an unknown referral code", () => {
    const result = trackReferral("UNKNOWN-CODE-XYZ", "user-ref-012");
    expect(result).toBeNull();
  });

  it("returns null when referrer and referred are the same user (self-referral)", () => {
    const userId = "user-ref-013";
    const code = getReferralCode(userId);
    const result = trackReferral(code, userId);
    expect(result).toBeNull();
  });
});

describe("getReferralsByUser", () => {
  it("returns all referrals made by a given referrer", () => {
    const referrerId = "user-ref-020";
    const code = getReferralCode(referrerId);

    trackReferral(code, "user-ref-021");
    trackReferral(code, "user-ref-022");

    const referrals = getReferralsByUser(referrerId);
    expect(referrals.length).toBeGreaterThanOrEqual(2);
    referrals.forEach((r) => expect(r.referrerId).toBe(referrerId));
  });

  it("returns an empty array for a user with no referrals", () => {
    const referrals = getReferralsByUser("user-ref-no-referrals-999");
    expect(referrals).toEqual([]);
  });
});

describe("getReferralCount", () => {
  it("returns zero for a user with no referrals", () => {
    const count = getReferralCount("user-ref-count-zero-999");
    expect(count).toBe(0);
  });

  it("increments count each time a referral is recorded", () => {
    const referrerId = "user-ref-030";
    const code = getReferralCode(referrerId);

    const before = getReferralCount(referrerId);
    trackReferral(code, "user-ref-031");
    trackReferral(code, "user-ref-032");
    const after = getReferralCount(referrerId);

    expect(after).toBe(before + 2);
  });
});
