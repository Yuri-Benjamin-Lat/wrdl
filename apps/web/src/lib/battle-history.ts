export type BattleHistoryStanding = {
  rank: number;
  playerId: string | null;
  username: string | null;
  displayName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  points: number;
  isProfileOwner: boolean;
};

export type BattleHistoryMatch = {
  id: string;
  completedAt: string;
  rounds: number;
  roundTimerSeconds: number;
  playerCount: number;
  placement: number;
  result: "win" | "loss" | "placement";
  scoreLine: string | null;
  completionReason: "score" | "forfeit";
  standings: BattleHistoryStanding[];
};

export type PlayerBattleHistory = {
  visible: boolean;
  matches: BattleHistoryMatch[];
};

export type BattleStatistics = {
  twoPlayerWins: number;
  twoPlayerLosses: number;
  threePlayerWins: number;
  threePlayerLosses: number;
  fourPlusWins: number;
  fourPlusLosses: number;
};

export const EMPTY_BATTLE_STATISTICS: BattleStatistics = {
  twoPlayerWins: 0,
  twoPlayerLosses: 0,
  threePlayerWins: 0,
  threePlayerLosses: 0,
  fourPlusWins: 0,
  fourPlusLosses: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(record: Record<string, unknown>, key: string, minimum: number, maximum: number) {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new TypeError(`Battle history has an invalid ${key}.`);
  }
  return value as number;
}

function nullableString(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") throw new TypeError("Battle history has invalid text.");
  return value;
}

export function parsePlayerBattleHistory(value: unknown): PlayerBattleHistory {
  if (!isRecord(value) || typeof value.visible !== "boolean" || !Array.isArray(value.matches)) {
    throw new TypeError("Player battle history must be an object.");
  }
  if (!value.visible && value.matches.length) {
    throw new TypeError("Private battle history leaked matches.");
  }
  if (value.matches.length > 20) throw new TypeError("Player battle history exceeded 20 matches.");

  const matches = value.matches.map((match, matchIndex): BattleHistoryMatch => {
    if (!isRecord(match) || !Array.isArray(match.standings) || match.standings.length > 8) {
      throw new TypeError(`Battle history match ${matchIndex + 1} is malformed.`);
    }
    if (
      typeof match.id !== "string" ||
      typeof match.completedAt !== "string" ||
      !Number.isFinite(Date.parse(match.completedAt)) ||
      (match.result !== "win" && match.result !== "loss" && match.result !== "placement")
    ) {
      throw new TypeError(`Battle history match ${matchIndex + 1} is malformed.`);
    }
    const playerCount = integer(match, "playerCount", 2, 8);
    const result = match.result;
    if ((playerCount === 2) !== (result === "win" || result === "loss")) {
      throw new TypeError("Battle history result does not match its player count.");
    }
    const scoreLine = nullableString(match.scoreLine);
    if ((playerCount === 2) !== (scoreLine !== null)) {
      throw new TypeError("Battle history score line does not match its player count.");
    }

    if (match.completionReason !== "score" && match.completionReason !== "forfeit") {
      throw new TypeError("Battle history completion reason is invalid.");
    }

    return {
      id: match.id,
      completedAt: match.completedAt,
      rounds: integer(match, "rounds", 1, 5),
      roundTimerSeconds: integer(match, "roundTimerSeconds", 30, 600),
      playerCount,
      placement: integer(match, "placement", 1, playerCount),
      result,
      scoreLine,
      completionReason: match.completionReason,
      standings: match.standings.map((standing): BattleHistoryStanding => {
        if (
          !isRecord(standing) ||
          typeof standing.displayName !== "string" ||
          typeof standing.points !== "number" ||
          !Number.isFinite(standing.points) ||
          standing.points < 0 ||
          typeof standing.isProfileOwner !== "boolean"
        ) {
          throw new TypeError("Battle history standing is malformed.");
        }
        return {
          rank: integer(standing, "rank", 1, playerCount),
          playerId: nullableString(standing.playerId),
          username: nullableString(standing.username),
          displayName: standing.displayName,
          avatarPath: nullableString(standing.avatarPath),
          avatarUrl: null,
          points: standing.points,
          isProfileOwner: standing.isProfileOwner,
        };
      }),
    };
  });

  return { visible: value.visible, matches };
}
