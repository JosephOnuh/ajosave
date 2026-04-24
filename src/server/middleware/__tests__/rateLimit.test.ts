// Mock next/server and sentry so the middleware module loads in the jsdom environment
jest.mock("next/server", () => ({
  NextRequest: class {},
  NextResponse: { json: jest.fn() },
}));
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));

import { rateLimit } from "../index";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("rateLimit", () => {
  it("allows requests within the limit", () => {
    const key = `test-within-${Math.random()}`;
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
  });

  it("blocks requests that exceed the limit", () => {
    const key = `test-exceed-${Math.random()}`;
    rateLimit(key, 2, 60_000);
    rateLimit(key, 2, 60_000);
    expect(rateLimit(key, 2, 60_000)).toBe(false);
  });

  it("allows requests again after the window resets", () => {
    const key = `test-reset-${Math.random()}`;
    rateLimit(key, 1, 60_000);
    expect(rateLimit(key, 1, 60_000)).toBe(false);

    jest.advanceTimersByTime(60_001);

    expect(rateLimit(key, 1, 60_000)).toBe(true);
  });

  it("tracks different keys independently", () => {
    const keyA = `test-keyA-${Math.random()}`;
    const keyB = `test-keyB-${Math.random()}`;
    rateLimit(keyA, 1, 60_000);
    expect(rateLimit(keyA, 1, 60_000)).toBe(false);
    expect(rateLimit(keyB, 1, 60_000)).toBe(true);
  });
});
