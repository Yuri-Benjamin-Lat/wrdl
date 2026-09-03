import { describe, expect, it } from "vitest";

import { parseLeaderboard } from "./leaderboard";

const viewer = {
  rank: 1,
  id: "a",
  username: "Yuri",
  displayName: "Haechan",
  avatarPath: null,
  streak: 12,
  isViewer: true,
};

describe("leaderboard payload validation", () => {
  it("accepts a dense ranked payload", () => {
    expect(parseLeaderboard({ scope: "global", items: [viewer], viewer }).viewer.rank).toBe(1);
  });

  it("rejects a global payload above its 100-player cap", () => {
    expect(() =>
      parseLeaderboard({ scope: "global", items: Array(101).fill(viewer), viewer }),
    ).toThrow("100");
  });
});
