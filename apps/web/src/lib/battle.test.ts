import { describe, expect, it } from "vitest";

import {
  canReuseBattleConnectionId,
  formatBattleClock,
  formatCentiseconds,
  parseBattleConnectionEnvelope,
  parseBattleSnapshot,
} from "./battle";

describe("canReuseBattleConnectionId", () => {
  const connectionId = "a9000000-0000-4000-8000-000000000001";

  it("keeps control through a refresh or history restoration", () => {
    expect(canReuseBattleConnectionId(connectionId, "reload")).toBe(true);
    expect(canReuseBattleConnectionId(connectionId, "back_forward")).toBe(true);
  });

  it("gives a newly opened or duplicated tab its own connection", () => {
    expect(canReuseBattleConnectionId(connectionId, "navigate")).toBe(false);
    expect(canReuseBattleConnectionId(connectionId, null)).toBe(false);
    expect(canReuseBattleConnectionId("unsafe", "reload")).toBe(false);
  });
});

const player = (
  id: string,
  username: string,
  connected = true,
  joinOrder = username === "viewer" ? 1 : 2,
) => ({
  id,
  username,
  displayName: username,
  alias: null,
  avatarPath: null,
  avatarUrl: null,
  level: 1,
  currentStreak: 0,
  relationship: username === "viewer" ? "self" : "friends",
  activityVisible: true,
  online: connected,
  lastOnlineAt: null,
  battleInvitesBlocked: false,
  joinOrder,
  points: 0,
  roundPoints: 0,
  rank: 1,
  roundRank: null,
  roundStatus: "active",
  acceptedGuessCount: 1,
  completionCentiseconds: null,
  connected,
  reconnectDeadline: connected ? null : "2026-08-30T00:00:30Z",
  continued: false,
  becameHostAt: null,
  guesses: [{ guessNumber: 1, guess: username === "viewer" ? "CRANE" : null, pattern: "01210" }],
});

const snapshot = {
  id: "10000000-0000-4000-8000-000000000001",
  partyId: "20000000-0000-4000-8000-000000000002",
  phase: "round_active",
  stateVersion: 4,
  serverTime: "2026-08-30T00:00:00Z",
  playerCount: 2,
  hostId: "30000000-0000-4000-8000-000000000003",
  rounds: 3,
  roundTimerSeconds: 180,
  targetPoints: 2,
  currentRound: 1,
  isSuddenDeath: false,
  suddenDeathRound: 0,
  waitingForPlayers: false,
  nextSuddenDeath: false,
  phaseDeadline: null,
  roundStartedAt: "2026-08-30T00:00:00Z",
  roundDeadline: "2026-08-30T00:03:00Z",
  preservationDeadline: null,
  winnerId: null,
  completionReason: null,
  viewer: player("30000000-0000-4000-8000-000000000003", "viewer"),
  opponent: player("40000000-0000-4000-8000-000000000004", "opponent"),
  players: [
    player("30000000-0000-4000-8000-000000000003", "viewer"),
    player("40000000-0000-4000-8000-000000000004", "opponent"),
  ],
};

describe("battle snapshot", () => {
  it("accepts an answer-free opponent progress payload", () => {
    const parsed = parseBattleSnapshot(snapshot);
    expect(parsed.opponent.guesses[0]?.guess).toBeNull();
    expect(parsed.targetPoints).toBe(2);
  });

  it("rejects an inconsistent target and malformed leaked guess", () => {
    expect(() => parseBattleSnapshot({ ...snapshot, targetPoints: 3 })).toThrow();
    expect(() =>
      parseBattleSnapshot({
        ...snapshot,
        opponent: {
          ...snapshot.opponent,
          guesses: [{ guessNumber: 1, guess: "secret", pattern: "01210" }],
        },
      }),
    ).toThrow();
  });

  it("accepts up to eight ordered players and multi-player round points", () => {
    const third = {
      ...player("50000000-0000-4000-8000-000000000005", "third", true, 3),
      rank: 2,
      roundRank: 2,
      roundPoints: 3,
    };
    const parsed = parseBattleSnapshot({
      ...snapshot,
      playerCount: 3,
      winnerId: null,
      players: [...snapshot.players, third],
    });
    expect(parsed.players).toHaveLength(3);
    expect(parsed.players[2]?.roundPoints).toBe(3);
  });

  it("validates explicit cross-device connection states", () => {
    expect(parseBattleConnectionEnvelope({ status: "controlling", battle: snapshot }).status).toBe(
      "controlling",
    );
    expect(
      parseBattleConnectionEnvelope({ status: "active_elsewhere", battle: snapshot }).status,
    ).toBe("active_elsewhere");
    expect(
      parseBattleConnectionEnvelope({ status: "unavailable", battle: null }).battle,
    ).toBeNull();
    expect(() =>
      parseBattleConnectionEnvelope({ status: "active_elsewhere", battle: null }),
    ).toThrow();
  });
});

describe("battle time formatting", () => {
  it("formats countdowns and exact completion buckets", () => {
    expect(formatBattleClock(9.01)).toBe("00:10");
    expect(formatBattleClock(-2)).toBe("00:00");
    expect(formatCentiseconds(5432)).toBe("00:54.32");
    expect(formatCentiseconds(null)).toBe("--:--");
  });
});
