import { describe, expect, it } from "vitest";

import { parseFriendsPage, parseSocialPlayer } from "./social";

const player = {
  id: "38e9811c-952f-4c64-aed9-c93c496d32ab",
  username: "Mika",
  displayName: "Mika",
  avatarPath: null,
  level: 2,
  currentStreak: 12,
  relationship: "friends",
  alias: null,
  activityVisible: true,
  online: true,
  lastOnlineAt: "2026-08-30T00:00:00.000Z",
  battleInvitesBlocked: false,
};

describe("social payload validation", () => {
  it("accepts a privacy-safe social player", () => {
    expect(parseSocialPlayer(player)).toMatchObject({ username: "Mika", online: true });
  });

  it("rejects hidden activity that leaks a timestamp", () => {
    expect(() =>
      parseSocialPlayer({
        ...player,
        activityVisible: false,
        online: false,
      }),
    ).toThrow("leaked");
  });

  it("validates paginated friend lists", () => {
    expect(parseFriendsPage({ items: [player], hasMore: false, nextOffset: 1 })).toMatchObject({
      hasMore: false,
      nextOffset: 1,
    });
  });
});
