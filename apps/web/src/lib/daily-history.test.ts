import { describe, expect, it } from "vitest";

import { parseDailyHistory } from "./daily-history";

const history = {
  wins: 4,
  missed: 1,
  failed: 2,
  currentStreak: 3,
  highestStreak: 12,
  cards: [
    {
      date: "2026-08-29",
      puzzleNumber: 1,
      status: "win",
      acceptedGuessCount: 1,
      guesses: [
        {
          number: 1,
          guess: "crane",
          pattern: "22222",
          acceptedAt: "2026-08-29T01:00:00.000Z",
        },
      ],
    },
  ],
};

describe("Daily history validation", () => {
  it("accepts an answer-free card collection", () => {
    expect(parseDailyHistory(history)).toMatchObject({
      wins: 4,
      currentStreak: 3,
      highestStreak: 12,
      cards: [{ status: "win" }],
    });
  });

  it("rejects protected answers at every payload level", () => {
    expect(() => parseDailyHistory({ ...history, answer: "crane" })).toThrow("protected answer");
    expect(() =>
      parseDailyHistory({
        ...history,
        cards: [{ ...history.cards[0], answer: "crane" }],
      }),
    ).toThrow("unsafe");
  });

  it("rejects malformed cards and more than 30 entries", () => {
    expect(() =>
      parseDailyHistory({
        ...history,
        cards: [{ ...history.cards[0], status: "lost" }],
      }),
    ).toThrow("status");
    expect(() =>
      parseDailyHistory({ ...history, cards: Array(31).fill(history.cards[0]) }),
    ).toThrow("30 cards");
  });

  it("rejects a highest streak below the current streak", () => {
    expect(() => parseDailyHistory({ ...history, highestStreak: 2 })).toThrow("highestStreak");
  });
});
