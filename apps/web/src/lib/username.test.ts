import { describe, expect, it } from "vitest";
import { normalizeUsername, validateUsernameFormat } from "./username";

describe("username rules", () => {
  it("accepts 1 to 20 letters and numbers", () => {
    expect(validateUsernameFormat("Yuri25")).toEqual({
      valid: true,
      message: "Username available",
    });
    expect(validateUsernameFormat("A").valid).toBe(true);
    expect(validateUsernameFormat("a".repeat(20)).valid).toBe(true);
  });

  it("rejects empty, long, spaced, or punctuated usernames", () => {
    expect(validateUsernameFormat("").valid).toBe(false);
    expect(validateUsernameFormat("a".repeat(21)).valid).toBe(false);
    expect(validateUsernameFormat("Yuri Flores").valid).toBe(false);
    expect(validateUsernameFormat("yuri_25").valid).toBe(false);
  });

  it("normalizes casing for uniqueness", () => {
    expect(normalizeUsername("Yuri")).toBe(normalizeUsername("yuri"));
  });
});
