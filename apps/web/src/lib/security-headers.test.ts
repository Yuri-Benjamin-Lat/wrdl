import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, securityHeaders } from "./security-headers";

describe("WRDL security headers", () => {
  it("locks framing, objects, browser permissions, and data origins", () => {
    const policy = buildContentSecurityPolicy(false);
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("connect-src 'self' https://*.supabase.co wss://*.supabase.co");
    expect(policy).not.toContain("'unsafe-eval'");

    const headers = new Map(securityHeaders(false).map(({ key, value }) => [key, value]));
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Strict-Transport-Security")).toContain("max-age=63072000");
  });

  it("allows the development evaluator without weakening production", () => {
    expect(buildContentSecurityPolicy(true)).toContain("'unsafe-eval'");
    expect(securityHeaders(true).some(({ key }) => key === "Strict-Transport-Security")).toBe(
      false,
    );
  });
});
