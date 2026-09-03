import { describe, expect, it } from "vitest";

import { redactSentryEvent } from "./sentry-privacy";

describe("Sentry privacy redaction", () => {
  it("removes identity, request, gameplay, and raw error text", () => {
    const event = redactSentryEvent({
      type: undefined,
      message: "player@example.com guessed CRANE",
      transaction: "/profile/private-player",
      user: { email: "player@example.com" },
      request: { url: "https://wrdl.example/profile/private-player" },
      breadcrumbs: [{ message: "secret-token" }],
      contexts: { gameplay: { answer: "CRANE" } },
      extra: { token: "secret-token" },
      fingerprint: ["private-player"],
      tags: { username: "private-player" },
      exception: {
        values: [
          {
            type: "Error",
            value: "player@example.com guessed CRANE",
            stacktrace: {
              frames: [
                {
                  filename: "app.js",
                  function: "submitGuess",
                  lineno: 12,
                  colno: 4,
                  context_line: "submitGuess('CRANE')",
                  vars: { email: "player@example.com" },
                },
              ],
            },
          },
        ],
      },
    });

    const serialized = JSON.stringify(event);
    expect(event.message).toBe("WRDL application error");
    expect(event.tags).toEqual({ privacy: "redacted" });
    expect(serialized).not.toContain("player@example.com");
    expect(serialized).not.toContain("CRANE");
    expect(serialized).not.toContain("secret-token");
    expect(serialized).not.toContain("private-player");
    expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({
      filename: "app.js",
      function: "submitGuess",
      lineno: 12,
      colno: 4,
      in_app: undefined,
      module: undefined,
    });
  });
});
