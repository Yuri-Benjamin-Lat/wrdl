import { describe, expect, it } from "vitest";

import { parsePartySnapshot } from "./party";

const member = {
  id: "a6000000-0000-4000-8000-000000000001",
  username: "yuri",
  displayName: "Yuri",
  avatarPath: null,
  level: 1,
  currentStreak: 0,
  relationship: "self",
  alias: null,
  activityVisible: true,
  online: true,
  lastOnlineAt: "2026-08-30T00:00:00Z",
  battleInvitesBlocked: false,
  joinOrder: 1,
  ready: false,
  returnedToLobby: true,
  isHost: true,
};

const snapshot = {
  id: "c6000000-0000-4000-8000-000000000003",
  phase: "lobby",
  hostId: member.id,
  isHost: true,
  rounds: 3,
  roundTimerSeconds: 180,
  stateVersion: 1,
  startDeadline: null,
  activeBattleId: null,
  memberCount: 1,
  readyCount: 0,
  members: [member],
};

describe("party payload validation", () => {
  it("accepts an authoritative Lobby snapshot", () => {
    expect(parsePartySnapshot(snapshot)).toMatchObject({ phase: "lobby", rounds: 3 });
  });

  it("rejects a countdown without a server deadline", () => {
    expect(() => parsePartySnapshot({ ...snapshot, phase: "match_starting" })).toThrow("countdown");
  });

  it("rejects inconsistent Ready totals", () => {
    expect(() => parsePartySnapshot({ ...snapshot, readyCount: 1 })).toThrow("Ready count");
  });
});
