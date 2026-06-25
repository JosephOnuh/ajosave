import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.NEXTAUTH_URL,
  "http://localhost:3000",
  "https://ajosave.app",
  "https://www.ajosave.app",
]
  .filter(Boolean)
  .map((origin) => origin!.trim().replace(/\/$/, ""));

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' https://unpkg.com",
    "connect-src 'self' https://horizon.stellar.org https://horizon-testnet.stellar.org https://api.paystack.co https://api.ng.termii.com https://*.ingest.sentry.io",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const nonce = randomBytes(16).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Handle CORS for API routes
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const isAllowed = origin && ALLOWED_ORIGINS.includes(origin);
    const response = request.method === "OPTIONS"
      ? new NextResponse(null, { status: 204 })
      : NextResponse.next({ request: { headers: requestHeaders } });

    response.headers.set("Content-Security-Policy-Report-Only", csp);

    if (isAllowed) {
      response.headers.set("Access-Control-Allow-Origin", origin!);
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-CSRF-Token");
      response.headers.set("Access-Control-Allow-Credentials", "true");
      response.headers.set("Access-Control-Max-Age", "86400");
    }
    return response;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy-Report-Only", csp);

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    // Apply CSP to all page routes (exclude static files and _next internals)
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
