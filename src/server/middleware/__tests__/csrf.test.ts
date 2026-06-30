/**
 * Unit tests for withCsrf middleware — Issue #480
 *
 * Verifies the double-submit cookie pattern:
 *   - GET requests always pass through (safe method)
 *   - POST without token → 403
 *   - POST with mismatched token → 403
 *   - POST with valid matching token → passes through to handler
 */

import { NextRequest, NextResponse } from "next/server";
import { withCsrf } from "@/server/middleware";
import { generateCsrfToken, setCsrfCookie, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@/lib/csrf";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(
  method: string,
  options: { cookieToken?: string; headerToken?: string } = {}
): NextRequest {
  const req = new NextRequest("http://localhost/api/test", { method });

  if (options.cookieToken) {
    // NextRequest cookies are read-only — build via Headers
    Object.defineProperty(req, "cookies", {
      get: () => ({
        get: (name: string) =>
          name === CSRF_COOKIE_NAME ? { value: options.cookieToken } : undefined,
      }),
    });
  }

  if (options.headerToken) {
    Object.defineProperty(req.headers, "get", {
      value: (name: string) =>
        name === CSRF_HEADER_NAME ? options.headerToken : null,
      configurable: true,
    });
  }

  return req;
}

const okHandler = jest.fn(async () => NextResponse.json({ ok: true }, { status: 200 }));

beforeEach(() => {
  okHandler.mockClear();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("withCsrf middleware", () => {
  it("allows GET requests without any CSRF token", async () => {
    const req = new NextRequest("http://localhost/api/test", { method: "GET" });
    const response = await withCsrf(okHandler)(req);
    expect(response.status).toBe(200);
    expect(okHandler).toHaveBeenCalledTimes(1);
  });

  it("allows HEAD requests without any CSRF token", async () => {
    const req = new NextRequest("http://localhost/api/test", { method: "HEAD" });
    const response = await withCsrf(okHandler)(req);
    expect(response.status).toBe(200);
  });

  it("allows OPTIONS requests without any CSRF token", async () => {
    const req = new NextRequest("http://localhost/api/test", { method: "OPTIONS" });
    const response = await withCsrf(okHandler)(req);
    expect(response.status).toBe(200);
  });

  it("returns 403 for POST with missing CSRF token", async () => {
    const req = makeRequest("POST");
    const response = await withCsrf(okHandler)(req);
    expect(response.status).toBe(403);
    expect(okHandler).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.code).toBe("CSRF_INVALID");
  });

  it("returns 403 for PUT with missing header token", async () => {
    const token = generateCsrfToken();
    const req = makeRequest("PUT", { cookieToken: token });
    const response = await withCsrf(okHandler)(req);
    expect(response.status).toBe(403);
    expect(okHandler).not.toHaveBeenCalled();
  });

  it("returns 403 for POST with mismatched tokens", async () => {
    const token1 = generateCsrfToken();
    const token2 = generateCsrfToken(); // different token
    const req = makeRequest("POST", { cookieToken: token1, headerToken: token2 });
    const response = await withCsrf(okHandler)(req);
    expect(response.status).toBe(403);
    expect(okHandler).not.toHaveBeenCalled();
  });

  it("allows POST with valid matching CSRF token", async () => {
    const token = generateCsrfToken();
    const req = makeRequest("POST", { cookieToken: token, headerToken: token });
    const response = await withCsrf(okHandler)(req);
    expect(response.status).toBe(200);
    expect(okHandler).toHaveBeenCalledTimes(1);
  });

  it("allows PATCH with valid CSRF token", async () => {
    const token = generateCsrfToken();
    const req = makeRequest("PATCH", { cookieToken: token, headerToken: token });
    const response = await withCsrf(okHandler)(req);
    expect(response.status).toBe(200);
  });

  it("allows DELETE with valid CSRF token", async () => {
    const token = generateCsrfToken();
    const req = makeRequest("DELETE", { cookieToken: token, headerToken: token });
    const response = await withCsrf(okHandler)(req);
    expect(response.status).toBe(200);
  });
});

describe("generateCsrfToken", () => {
  it("generates a 64-char hex string", () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("generates unique tokens on each call", () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    expect(t1).not.toBe(t2);
  });
});

describe("setCsrfCookie", () => {
  it("sets __csrf cookie on response", () => {
    const token = generateCsrfToken();
    const res = NextResponse.json({});
    setCsrfCookie(res, token);
    const cookie = res.cookies.get(CSRF_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBe(token);
  });
});
