/**
 * GET /api/auth/csrf
 *
 * Issues a CSRF token to the client.
 *
 * The server generates a random token, stores it as a JS-readable cookie
 * (__csrf), and returns it in the JSON body so the client can also send it
 * as the x-csrf-token header on every mutating request.
 *
 * This endpoint requires no authentication — CSRF tokens protect state-
 * changing requests regardless of auth status.
 */

import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/server/middleware";
import { generateCsrfToken, setCsrfCookie } from "@/lib/csrf";

async function handler(_req: NextRequest): Promise<NextResponse> {
  const token = generateCsrfToken();
  const response = NextResponse.json({ token });
  setCsrfCookie(response, token);
  return response;
}

export const GET = withErrorHandler(handler);
