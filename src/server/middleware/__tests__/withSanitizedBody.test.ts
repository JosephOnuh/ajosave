/**
 * @jest-environment node
 */
/// <reference types="jest" />
import { NextRequest, NextResponse } from "next/server";
import { withSanitizedBody } from "../index";

function makeRequest(body: unknown, contentType = "application/json"): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": contentType },
    body: JSON.stringify(body),
  });
}

describe("withSanitizedBody", () => {
  it("strips XSS payload from string fields before handler receives them", async () => {
    let capturedBody: unknown;
    const handler = jest.fn(async (req: NextRequest) => {
      capturedBody = await req.json();
      return NextResponse.json({ ok: true });
    });

    const req = makeRequest({ stellarAddress: '<script>alert("xss")</script>GABC123' });
    await withSanitizedBody(handler)(req, undefined);

    expect(capturedBody).toEqual({ stellarAddress: 'alert("xss")GABC123' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("passes non-XSS bodies through unchanged", async () => {
    let capturedBody: unknown;
    const handler = jest.fn(async (req: NextRequest) => {
      capturedBody = await req.json();
      return NextResponse.json({ ok: true });
    });

    const req = makeRequest({ amount: 1000, note: "Monthly contribution" });
    await withSanitizedBody(handler)(req, undefined);

    expect(capturedBody).toEqual({ amount: 1000, note: "Monthly contribution" });
  });

  it("sanitizes nested objects and arrays", async () => {
    let capturedBody: unknown;
    const handler = jest.fn(async (req: NextRequest) => {
      capturedBody = await req.json();
      return NextResponse.json({ ok: true });
    });

    const req = makeRequest({ tags: ["<b>savings</b>", "circle"], meta: { name: "<em>ajo</em>" } });
    await withSanitizedBody(handler)(req, undefined);

    expect(capturedBody).toEqual({ tags: ["savings", "circle"], meta: { name: "ajo" } });
  });

  it("passes through non-JSON content types without modification", async () => {
    const handler = jest.fn(async (_req: NextRequest) => NextResponse.json({ ok: true }));
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "plain text body",
    });

    await withSanitizedBody(handler)(req, undefined);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
