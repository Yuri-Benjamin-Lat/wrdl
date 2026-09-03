import { afterEach, describe, expect, it, vi } from "vitest";

import { reportApplicationError } from "./observability";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("privacy-safe application error reporting", () => {
  it("records a fixed event and safe framework digest", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportApplicationError("page_render_failed", {
      digest: "safe_digest-123",
      message: "player@example.com guessed CRANE with token secret-token",
      stack: "private stack",
    });

    expect(consoleError).toHaveBeenCalledOnce();
    const payload = String(consoleError.mock.calls[0]?.[0]);
    expect(JSON.parse(payload)).toEqual({
      level: "error",
      event: "page_render_failed",
      digest: "safe_digest-123",
    });
    expect(payload).not.toContain("player@example.com");
    expect(payload).not.toContain("CRANE");
    expect(payload).not.toContain("secret-token");
    expect(payload).not.toContain("private stack");
  });

  it("drops malformed digests instead of logging untrusted text", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportApplicationError("battle_snapshot_unavailable", {
      digest: "email=player@example.com",
    });

    expect(JSON.parse(String(consoleError.mock.calls[0]?.[0]))).toEqual({
      level: "error",
      event: "battle_snapshot_unavailable",
    });
  });
});
