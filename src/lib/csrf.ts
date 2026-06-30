/**
 * CSRF Token Utilities — Issue #480
 *
 * Implements the double-submit cookie pattern:
 *   1. Server generates a random token and sets it as a JS-readable cookie (__csrf).
 *   2. Client reads the cookie and sends it as the x-csrf-token request header.
 *   3. Server compares HMAC hashes of both values — they must match.
 *
 * Environment variables:
 *   CSRF_SECRET  — arbitrary string used as the HMAC key.
 *                  Defaults to 'change-me-in-production' if not set.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";

export const CSRF_COOKIE_NAME = "__csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

const CSRF_SECRET = (): string =>
  process.env.CSRF_SECRET ?? "change-me-in-production";

/**
 * Generate a cryptographically random 32-byte hex token.
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Compute an HMAC-SHA256 digest of the given token using CSRF_SECRET.
 * Returns a hex-encoded string.
 */
export function hashCsrfToken(token: string): string {
  return createHmac("sha256", CSRF_SECRET()).update(token, "utf8").digest("hex");
}

/**
 * Set the __csrf cookie on a NextResponse.
 * httpOnly is intentionally false so the browser JS can read and forward it
 * as the x-csrf-token request header.
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/**
 * Validate the double-submit pattern.
 * Compares HMAC hashes of the cookie token and the header token in constant time.
 * Returns true only when both tokens produce the same HMAC digest.
 */
export function validateCsrfToken(cookieToken: string, headerToken: string): boolean {
  const hashCookie = Buffer.from(hashCsrfToken(cookieToken), "hex");
  const hashHeader = Buffer.from(hashCsrfToken(headerToken), "hex");
  if (hashCookie.length !== hashHeader.length) return false;
  return timingSafeEqual(hashCookie, hashHeader);
}
