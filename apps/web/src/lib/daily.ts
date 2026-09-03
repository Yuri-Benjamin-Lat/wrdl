import type { TileEvaluation } from "@wrdl/game-core";

export type DailyClientStatus =
  "unavailable" | "not_started" | "in_progress" | "win" | "failed" | "voided";

export type DailyGuess = {
  number: number;
  guess: string;
  pattern: string;
  acceptedAt: string;
};

export type DailySnapshot = {
  officialDate: string;
  serverTime: string;
  resetAt: string;
  eligible: boolean;
  puzzleNumber: number | null;
  status: DailyClientStatus;
  guesses: DailyGuess[];
  acceptedGuessCount: number;
  rewardExperience: number;
  streak: number;
  level: number;
  experience: number;
  wins: number;
  missed: number;
  failed: number;
};

const statuses = new Set<DailyClientStatus>([
  "unavailable",
  "not_started",
  "in_progress",
  "win",
  "failed",
  "voided",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string") throw new TypeError(`Daily snapshot is missing ${key}.`);
  return value;
}

function requiredInteger(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`Daily snapshot has an invalid ${key}.`);
  }
  return value as number;
}

export function parseDailySnapshot(value: unknown): DailySnapshot {
  if (!isRecord(value)) throw new TypeError("Daily snapshot must be an object.");
  if ("answer" in value) throw new TypeError("Daily snapshot exposed a protected answer.");

  const status = value.status;
  if (typeof status !== "string" || !statuses.has(status as DailyClientStatus)) {
    throw new TypeError("Daily snapshot has an invalid status.");
  }
  if (typeof value.eligible !== "boolean") {
    throw new TypeError("Daily snapshot has an invalid eligibility value.");
  }
  if (
    value.puzzleNumber !== null &&
    (!Number.isSafeInteger(value.puzzleNumber) || (value.puzzleNumber as number) < 1)
  ) {
    throw new TypeError("Daily snapshot has an invalid puzzle number.");
  }
  if (!Array.isArray(value.guesses))
    throw new TypeError("Daily snapshot guesses must be an array.");

  const guesses = value.guesses.map((guess, index): DailyGuess => {
    if (!isRecord(guess)) throw new TypeError(`Daily guess ${index + 1} is invalid.`);
    const number = requiredInteger(guess, "number");
    const word = requiredString(guess, "guess");
    const pattern = requiredString(guess, "pattern");
    const acceptedAt = requiredString(guess, "acceptedAt");
    if (number < 1 || number > 6 || !/^[a-z]{5}$/.test(word) || !/^[012]{5}$/.test(pattern)) {
      throw new TypeError(`Daily guess ${index + 1} is malformed.`);
    }
    return { number, guess: word, pattern, acceptedAt };
  });

  return {
    officialDate: requiredString(value, "officialDate"),
    serverTime: requiredString(value, "serverTime"),
    resetAt: requiredString(value, "resetAt"),
    eligible: value.eligible,
    puzzleNumber: value.puzzleNumber as number | null,
    status: status as DailyClientStatus,
    guesses,
    acceptedGuessCount: requiredInteger(value, "acceptedGuessCount"),
    rewardExperience: requiredInteger(value, "rewardExperience"),
    streak: requiredInteger(value, "streak"),
    level: requiredInteger(value, "level"),
    experience: requiredInteger(value, "experience"),
    wins: requiredInteger(value, "wins"),
    missed: requiredInteger(value, "missed"),
    failed: requiredInteger(value, "failed"),
  };
}

export function dailyPatternEvaluation(pattern: string): TileEvaluation[] {
  if (!/^[012]{5}$/.test(pattern)) throw new RangeError("Daily pattern must contain five tiles.");
  return pattern.split("").map((tile) => {
    if (tile === "2") return "correct";
    if (tile === "1") return "present";
    return "absent";
  });
}

export function formatDailyCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
