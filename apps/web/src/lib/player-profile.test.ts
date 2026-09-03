import { describe, expect, it } from "vitest";

import { parsePlayerDailyHistory, parsePlayerProfile } from "./player-profile";

describe("friend profile privacy payloads", () => {
  it("accepts lifetime Friendly Battle statistics", () => {
    const profile = parsePlayerProfile({
      id: "player-1",
      username: "yuri",
      displayName: "Yuri",
      avatarPath: null,
      level: 1,
      currentStreak: 0,
      relationship: "self",
      alias: null,
      activityVisible: true,
      online: true,
      lastOnlineAt: "2026-08-30T10:00:00Z",
      battleInvitesBlocked: false,
      bio: null,
      experience: 0,
      experienceCap: 20,
      isOwner: true,
      isFriend: false,
      dailyHistoryVisible: true,
      statisticsVisible: true,
      battleHistoryVisible: true,
      dailyHistoryAudience: "public",
      statisticsAudience: "public",
      battleHistoryAudience: "public",
      statistics: {
        wins: 0,
        missed: 0,
        failed: 0,
        currentStreak: 0,
        highestStreak: 0,
        battles: {
          twoPlayerWins: 3,
          twoPlayerLosses: 1,
          threePlayerWins: 2,
          threePlayerLosses: 4,
          fourPlusWins: 1,
          fourPlusLosses: 5,
        },
      },
    });
    expect(profile.statistics?.battles.twoPlayerWins).toBe(3);
  });

  it("accepts a current-day color grid with hidden letters", () => {
    const result = parsePlayerDailyHistory({
      visible: true,
      cards: [
        {
          date: "2026-08-30",
          puzzleNumber: 1,
          status: "in_progress",
          acceptedGuessCount: 1,
          lettersHidden: true,
          guesses: [{ number: 1, guess: null, pattern: "01210", acceptedAt: "now" }],
        },
      ],
    });
    expect(result.cards[0].lettersHidden).toBe(true);
  });

  it("rejects letters inside a hidden current-day card", () => {
    expect(() =>
      parsePlayerDailyHistory({
        visible: true,
        cards: [
          {
            date: "2026-08-30",
            puzzleNumber: 1,
            status: "in_progress",
            acceptedGuessCount: 1,
            lettersHidden: true,
            guesses: [{ number: 1, guess: "crane", pattern: "01210", acceptedAt: "now" }],
          },
        ],
      }),
    ).toThrow("malformed");
  });
});
