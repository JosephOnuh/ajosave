import { middleware } from "@/middleware";

describe("middleware CSP headers", () => {
  it("adds CSP report-only headers to API responses", () => {
    const response = middleware({
      headers: new Headers(),
      nextUrl: { pathname: "/api/auth/logout" },
      method: "GET",
    } as any);

    expect(response.headers.get("Content-Security-Policy-Report-Only")).toContain("default-src 'self'");
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toContain("script-src");
  });

  it("adds a nonce-based CSP header for page requests", () => {
    const response = middleware({
      headers: new Headers(),
      nextUrl: { pathname: "/dashboard" },
      method: "GET",
    } as any);
    const csp = response.headers.get("Content-Security-Policy-Report-Only") ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
  });
});
