export type LeaderboardScope = "global" | "friends";

export type LeaderboardPlayer = {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  streak: number;
  isViewer: boolean;
};

export type LeaderboardPayload = {
  scope: LeaderboardScope;
  items: LeaderboardPlayer[];
  viewer: LeaderboardPlayer;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRow(value: unknown): LeaderboardPlayer {
  if (!isRecord(value)) throw new TypeError("Leaderboard row must be an object.");
  if (
    !Number.isSafeInteger(value.rank) ||
    (value.rank as number) < 1 ||
    !Number.isSafeInteger(value.streak) ||
    (value.streak as number) < 0 ||
    typeof value.id !== "string" ||
    typeof value.username !== "string" ||
    typeof value.displayName !== "string" ||
    (value.avatarPath !== null && typeof value.avatarPath !== "string") ||
    typeof value.isViewer !== "boolean"
  ) {
    throw new TypeError("Leaderboard row is malformed.");
  }
  return {
    rank: value.rank as number,
    id: value.id,
    username: value.username,
    displayName: value.displayName,
    avatarPath: value.avatarPath,
    avatarUrl: null,
    streak: value.streak as number,
    isViewer: value.isViewer,
  };
}

export function parseLeaderboard(value: unknown): LeaderboardPayload {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new TypeError("Leaderboard payload must be an object.");
  }
  if (value.scope !== "global" && value.scope !== "friends") {
    throw new TypeError("Leaderboard scope is invalid.");
  }
  if (value.scope === "global" && value.items.length > 100) {
    throw new TypeError("Global leaderboard exceeded 100 players.");
  }
  if (value.items.length > 5000) throw new TypeError("Leaderboard is unexpectedly large.");

  return {
    scope: value.scope,
    items: value.items.map(parseRow),
    viewer: parseRow(value.viewer),
  };
}
