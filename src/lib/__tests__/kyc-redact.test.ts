/**
 * Tests for Issue #547 — api_key redaction in KYC helpers and logger.
 */
import { redactKey } from "../kyc";

// ── redactKey ─────────────────────────────────────────────────────────────────

describe("redactKey", () => {
  const secret = "super-secret-key-123";

  it("replaces a single occurrence of the secret", () => {
    expect(redactKey(`api_key=${secret}`, secret)).toBe("api_key=[REDACTED]");
  });

  it("replaces multiple occurrences", () => {
    expect(redactKey(`${secret} and again ${secret}`, secret)).toBe(
      "[REDACTED] and again [REDACTED]"
    );
  });

  it("returns the original text when secret is not present", () => {
    expect(redactKey("nothing sensitive here", secret)).toBe("nothing sensitive here");
  });

  it("returns the original text unchanged when secret is empty", () => {
    expect(redactKey("text", "")).toBe("text");
  });

  it("handles JSON error bodies that echo back the key", () => {
    const body = JSON.stringify({ error: "invalid api_key", key: secret });
    expect(redactKey(body, secret)).not.toContain(secret);
    expect(redactKey(body, secret)).toContain("[REDACTED]");
  });
});

// ── Logger redact config ──────────────────────────────────────────────────────
// Verify the REDACTED_KEYS constant in logger.ts covers api_key by reading
// the file synchronously with Node's fs (available in test env).

describe("logger REDACTED_KEYS", () => {
  it("logger source includes api_key in the redact configuration", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("fs") as typeof import("fs");
    const path = require("path") as typeof import("path");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../logger.ts"),
      "utf8"
    );
    expect(src).toContain("api_key");
    expect(src).toContain("[REDACTED]");
  });
});
