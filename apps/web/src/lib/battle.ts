import { parseSocialPlayer, type SocialPlayer } from "./social";

export type BattlePhase =
  | "round_starting"
  | "round_active"
  | "round_resolving"
  | "between_rounds"
  | "battle_complete"
  | "voided";
export type BattleRoundStatus = "active" | "solved" | "failed";
export type BattleCompletionReason = "score" | "forfeit" | "voided";
export type BattleConnectionStatus =
  "controlling" | "active_elsewhere" | "terminal" | "unavailable";

export type BattleGuess = {
  guessNumber: number;
  guess: string | null;
  pattern: string;
};

export type BattlePlayer = SocialPlayer & {
  joinOrder: number;
  points: number;
  roundPoints: number;
  rank: number;
  roundRank: number | null;
  roundStatus: BattleRoundStatus;
  acceptedGuessCount: number;
  completionCentiseconds: number | null;
  connected: boolean;
  reconnectDeadline: string | null;
  continued: boolean;
  becameHostAt: string | null;
  guesses: BattleGuess[];
};

export type BattleSnapshot = {
  id: string;
  partyId: string;
  phase: BattlePhase;
  stateVersion: number;
  serverTime: string;
  playerCount: number;
  hostId: string | null;
  rounds: 1 | 3 | 5;
  roundTimerSeconds: number;
  targetPoints: 1 | 2 | 3;
  currentRound: number;
  isSuddenDeath: boolean;
  suddenDeathRound: number;
  waitingForPlayers: boolean;
  nextSuddenDeath: boolean;
  phaseDeadline: string | null;
  roundStartedAt: string | null;
  roundDeadline: string | null;
  preservationDeadline: string | null;
  winnerId: string | null;
  completionReason: BattleCompletionReason | null;
  viewer: BattlePlayer;
  opponent: BattlePlayer;
  players: BattlePlayer[];
};

export type BattleConnectionEnvelope = {
  status: BattleConnectionStatus;
  battle: BattleSnapshot | null;
};

export function canReuseBattleConnectionId(
  connectionId: string | null,
  navigationType: string | null,
) {
  return Boolean(
    connectionId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      connectionId,
    ) &&
    (navigationType === "reload" || navigationType === "back_forward"),
  );
}

const phases = new Set<BattlePhase>([
  "round_starting",
  "round_active",
  "round_resolving",
  "between_rounds",
  "battle_complete",
  "voided",
]);
const roundStatuses = new Set<BattleRoundStatus>(["active", "solved", "failed"]);
const completionReasons = new Set<BattleCompletionReason>(["score", "forfeit", "voided"]);
const connectionStatuses = new Set<BattleConnectionStatus>([
  "controlling",
  "active_elsewhere",
  "terminal",
  "unavailable",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(record: Record<string, unknown>, key: string, minimum: number, maximum: number) {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new TypeError(`Battle payload has an invalid ${key}.`);
  }
  return value as number;
}

function requiredString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string" || !value) {
    throw new TypeError(`Battle payload has an invalid ${key}.`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== "string") throw new TypeError(`Battle payload has an invalid ${key}.`);
  return value;
}

function parseGuess(value: unknown): BattleGuess {
  if (!isRecord(value)) throw new TypeError("Battle guess is malformed.");
  const guess = value.guess;
  if (guess !== null && (typeof guess !== "string" || !/^[A-Z]{5}$/.test(guess))) {
    throw new TypeError("Battle guess letters are malformed.");
  }
  if (typeof value.pattern !== "string" || !/^[012]{5}$/.test(value.pattern)) {
    throw new TypeError("Battle guess pattern is malformed.");
  }
  return {
    guessNumber: integer(value, "guessNumber", 1, 6),
    guess,
    pattern: value.pattern,
  };
}

function parsePlayer(value: unknown): BattlePlayer {
  if (!isRecord(value) || !Array.isArray(value.guesses)) {
    throw new TypeError("Battle player is malformed.");
  }
  if (
    typeof value.roundStatus !== "string" ||
    !roundStatuses.has(value.roundStatus as BattleRoundStatus)
  ) {
    throw new TypeError("Battle player has an invalid round status.");
  }
  if (typeof value.connected !== "boolean" || typeof value.continued !== "boolean") {
    throw new TypeError("Battle player has invalid connection state.");
  }
  const rank = integer(value, "rank", 1, 8);
  return {
    ...parseSocialPlayer(value),
    joinOrder: integer(value, "joinOrder", 1, 8),
    points: integer(value, "points", 0, Number.MAX_SAFE_INTEGER),
    roundPoints: integer(value, "roundPoints", 0, 5),
    rank,
    roundRank: value.roundRank === null ? null : integer(value, "roundRank", 1, 8),
    roundStatus: value.roundStatus as BattleRoundStatus,
    acceptedGuessCount: integer(value, "acceptedGuessCount", 0, 6),
    completionCentiseconds:
      value.completionCentiseconds === null
        ? null
        : integer(value, "completionCentiseconds", 0, Number.MAX_SAFE_INTEGER),
    connected: value.connected,
    reconnectDeadline: optionalString(value, "reconnectDeadline"),
    continued: value.continued,
    becameHostAt: optionalString(value, "becameHostAt"),
    guesses: value.guesses.map(parseGuess),
  };
}

export function parseBattleSnapshot(value: unknown): BattleSnapshot {
  if (
    !isRecord(value) ||
    typeof value.phase !== "string" ||
    !phases.has(value.phase as BattlePhase)
  ) {
    throw new TypeError("Battle snapshot is malformed.");
  }
  const rounds = integer(value, "rounds", 1, 5);
  if (![1, 3, 5].includes(rounds)) throw new TypeError("Battle rounds are invalid.");
  const timer = integer(value, "roundTimerSeconds", 60, 600);
  if (timer % 30) throw new TypeError("Battle timer is invalid.");
  const target = integer(value, "targetPoints", 1, 3);
  if (target !== ({ 1: 1, 3: 2, 5: 3 } as Record<number, number>)[rounds]) {
    throw new TypeError("Battle target is inconsistent.");
  }
  const reason = value.completionReason;
  if (
    reason !== null &&
    (typeof reason !== "string" || !completionReasons.has(reason as BattleCompletionReason))
  ) {
    throw new TypeError("Battle completion reason is invalid.");
  }
  if (!Array.isArray(value.players)) throw new TypeError("Battle players are malformed.");
  const players = value.players.map(parsePlayer);
  const playerCount = integer(value, "playerCount", 2, 8);
  if (players.length !== playerCount) throw new TypeError("Battle player count is inconsistent.");
  if (new Set(players.map((player) => player.id)).size !== players.length) {
    throw new TypeError("Battle players must be distinct.");
  }
  const viewer = parsePlayer(value.viewer);
  const opponent = parsePlayer(value.opponent);
  if (viewer.id === opponent.id) throw new TypeError("Battle players must be distinct.");
  if (!players.some((player) => player.id === viewer.id)) {
    throw new TypeError("Battle viewer is not a participant.");
  }
  if (
    typeof value.isSuddenDeath !== "boolean" ||
    typeof value.waitingForPlayers !== "boolean" ||
    typeof value.nextSuddenDeath !== "boolean"
  ) {
    throw new TypeError("Battle sudden-death state is invalid.");
  }

  return {
    id: requiredString(value, "id"),
    partyId: requiredString(value, "partyId"),
    phase: value.phase as BattlePhase,
    stateVersion: integer(value, "stateVersion", 1, Number.MAX_SAFE_INTEGER),
    serverTime: requiredString(value, "serverTime"),
    playerCount,
    hostId: optionalString(value, "hostId"),
    rounds: rounds as 1 | 3 | 5,
    roundTimerSeconds: timer,
    targetPoints: target as 1 | 2 | 3,
    currentRound: integer(value, "currentRound", 1, Number.MAX_SAFE_INTEGER),
    isSuddenDeath: value.isSuddenDeath,
    suddenDeathRound: integer(value, "suddenDeathRound", 0, Number.MAX_SAFE_INTEGER),
    waitingForPlayers: value.waitingForPlayers,
    nextSuddenDeath: value.nextSuddenDeath,
    phaseDeadline: optionalString(value, "phaseDeadline"),
    roundStartedAt: optionalString(value, "roundStartedAt"),
    roundDeadline: optionalString(value, "roundDeadline"),
    preservationDeadline: optionalString(value, "preservationDeadline"),
    winnerId: optionalString(value, "winnerId"),
    completionReason: reason as BattleCompletionReason | null,
    viewer,
    opponent,
    players,
  };
}

export function parseBattleConnectionEnvelope(value: unknown): BattleConnectionEnvelope {
  if (
    !isRecord(value) ||
    typeof value.status !== "string" ||
    !connectionStatuses.has(value.status as BattleConnectionStatus)
  ) {
    throw new TypeError("Battle connection response is malformed.");
  }
  const battle = value.battle === null ? null : parseBattleSnapshot(value.battle);
  if (value.status === "unavailable" && battle !== null) {
    throw new TypeError("Unavailable battle connection includes a battle.");
  }
  if (value.status !== "unavailable" && battle === null) {
    throw new TypeError("Battle connection response omitted its battle.");
  }
  return { status: value.status as BattleConnectionStatus, battle };
}

export function formatBattleClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function formatCentiseconds(value: number | null) {
  if (value === null) return "--:--";
  const seconds = Math.floor(value / 100);
  const hundredths = value % 100;
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60)
    .toString()
    .padStart(2, "0")}.${hundredths.toString().padStart(2, "0")}`;
}
