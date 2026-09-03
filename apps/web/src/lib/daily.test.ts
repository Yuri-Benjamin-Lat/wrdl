import { describe, expect, it } from "vitest";

import { dailyPatternEvaluation, formatDailyCountdown, parseDailySnapshot } from "./daily";

const snapshot = {
  officialDate: "2026-08-29",
  serverTime: "2026-08-29T02:00:00.000Z",
  resetAt: "2026-08-29T16:00:00.000Z",
  eligible: true,
  puzzleNumber: 1,
  status: "in_progress",
  guesses: [
    {
      number: 1,
      guess: "crane",
      pattern: "01220",
      acceptedAt: "2026-08-29T02:01:00.000Z",
    },
  ],
  acceptedGuessCount: 1,
  rewardExperience: 0,
  streak: 4,
  level: 3,
  experience: 25,
  wins: 10,
  missed: 1,
  failed: 2,
};

describe("Daily snapshot validation", () => {
  it("accepts the answer-free server contract", () => {
    expect(parseDailySnapshot(snapshot)).toMatchObject({
      puzzleNumber: 1,
      status: "in_progress",
      acceptedGuessCount: 1,
    });
  });

  it("rejects a protected answer even if every public field is valid", () => {
    expect(() => parseDailySnapshot({ ...snapshot, answer: "crane" })).toThrow("protected answer");
  });

  it("rejects malformed patterns and statuses", () => {
    expect(() =>
      parseDailySnapshot({ ...snapshot, guesses: [{ ...snapshot.guesses[0], pattern: "green" }] }),
    ).toThrow("malformed");
    expect(() => parseDailySnapshot({ ...snapshot, status: "solved" })).toThrow("status");
  });
});

describe("Daily presentation helpers", () => {
  it("maps compact database patterns to shared tile states", () => {
    expect(dailyPatternEvaluation("01220")).toEqual([
      "absent",
      "present",
      "correct",
      "correct",
      "absent",
    ]);
  });

  it("formats a synchronized reset countdown", () => {
    expect(formatDailyCountdown(8 * 60 * 60 * 1000 + 42 * 60 * 1000 + 16 * 1000)).toBe("08:42:16");
    expect(formatDailyCountdown(-1)).toBe("00:00:00");
  });
});
