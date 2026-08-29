import { describe, expect, it } from "vitest";

import { streakHue, usernameChangeAvailableAt, validateBio, validateDisplayName } from "./profile";

describe("profile validation", () => {
  it("accepts optional alphanumeric display names", () => {
    expect(validateDisplayName("").valid).toBe(true);
    expect(validateDisplayName("Yuri25").valid).toBe(true);
    expect(validateDisplayName("Yuri Flores").valid).toBe(false);
    expect(validateDisplayName("a".repeat(21)).valid).toBe(false);
  });

  it("limits bios to 60 characters", () => {
    expect(validateBio("a".repeat(60)).valid).toBe(true);
    expect(validateBio("a".repeat(61)).valid).toBe(false);
  });

  it("moves the streak hue from red to violet and caps at 100", () => {
    expect(streakHue(1)).toBe(4);
    expect(streakHue(100)).toBe(278);
    expect(streakHue(500)).toBe(278);
    expect(streakHue(50)).toBeGreaterThan(streakHue(10));
  });

  it("calculates the 90-day username cooldown", () => {
    expect(usernameChangeAvailableAt(null)).toBeNull();
    expect(usernameChangeAvailableAt("2026-01-01T00:00:00.000Z")?.toISOString()).toBe(
      "2026-04-01T00:00:00.000Z",
    );
  });
});
