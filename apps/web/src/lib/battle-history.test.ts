import { describe, expect, it } from "vitest";

import { parsePlayerBattleHistory } from "./battle-history";

const match = {
  id: "match-1",
  completedAt: "2026-08-30T10:00:00Z",
  rounds: 5,
  roundTimerSeconds: 180,
  playerCount: 2,
  placement: 1,
  result: "win",
  scoreLine: "18–15",
  completionReason: "score",
  standings: [
    {
      rank: 1,
      playerId: "player-1",
      username: "yuri",
      displayName: "Yuri",
      avatarPath: null,
      points: 18,
      isProfileOwner: true,
    },
  ],
};

describe("battle history privacy payloads", () => {
  it("accepts a compact two-player battle", () => {
    const result = parsePlayerBattleHistory({ visible: true, matches: [match] });
    expect(result.matches[0].scoreLine).toBe("18–15");
  });

  it("rejects matches in a private payload", () => {
    expect(() => parsePlayerBattleHistory({ visible: false, matches: [match] })).toThrow("leaked");
  });

  it("accepts a deletion-safe standing", () => {
    const deleted = {
      ...match,
      standings: [
        {
          ...match.standings[0],
          playerId: null,
          username: null,
          displayName: "Deleted Player",
        },
      ],
    };
    expect(
      parsePlayerBattleHistory({ visible: true, matches: [deleted] }).matches[0].standings[0],
    ).toMatchObject({ playerId: null, displayName: "Deleted Player" });
  });
});
