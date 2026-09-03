import type { DailyGuess } from "./daily";

export type DailyHistoryStatus =
  "not_started" | "in_progress" | "win" | "failed" | "missed" | "voided";

export type DailyHistoryCard = {
  date: string;
  puzzleNumber: number;
  status: DailyHistoryStatus;
  acceptedGuessCount: number;
  guesses: DailyGuess[];
};

export type DailyHistory = {
  wins: number;
  missed: number;
  failed: number;
  currentStreak: number;
  highestStreak: number;
  cards: DailyHistoryCard[];
};

const statuses = new Set<DailyHistoryStatus>([
  "not_started",
  "in_progress",
  "win",
  "failed",
  "missed",
  "voided",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(record: Record<string, unknown>, key: string, maximum?: number) {
  const value = record[key];
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (maximum !== undefined && (value as number) > maximum)
  ) {
    throw new TypeError(`Daily history has an invalid ${key}.`);
  }
  return value as number;
}

export function parseDailyHistory(value: unknown): DailyHistory {
  if (!isRecord(value)) throw new TypeError("Daily history must be an object.");
  if ("answer" in value) throw new TypeError("Daily history exposed a protected answer.");
  if (!Array.isArray(value.cards)) throw new TypeError("Daily history cards must be an array.");
  if (value.cards.length > 30) throw new TypeError("Daily history exceeded 30 cards.");

  const cards = value.cards.map((card, cardIndex): DailyHistoryCard => {
    if (!isRecord(card) || "answer" in card) {
      throw new TypeError(`Daily history card ${cardIndex + 1} is unsafe.`);
    }
    const status = card.status;
    if (typeof status !== "string" || !statuses.has(status as DailyHistoryStatus)) {
      throw new TypeError(`Daily history card ${cardIndex + 1} has an invalid status.`);
    }
    if (typeof card.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(card.date)) {
      throw new TypeError(`Daily history card ${cardIndex + 1} has an invalid date.`);
    }
    if (!Array.isArray(card.guesses) || card.guesses.length > 6) {
      throw new TypeError(`Daily history card ${cardIndex + 1} has invalid guesses.`);
    }

    const guesses = card.guesses.map((guess, guessIndex): DailyGuess => {
      if (!isRecord(guess) || "answer" in guess) {
        throw new TypeError(`Daily history guess ${guessIndex + 1} is unsafe.`);
      }
      if (
        !Number.isSafeInteger(guess.number) ||
        (guess.number as number) < 1 ||
        (guess.number as number) > 6 ||
        typeof guess.guess !== "string" ||
        !/^[a-z]{5}$/.test(guess.guess) ||
        typeof guess.pattern !== "string" ||
        !/^[012]{5}$/.test(guess.pattern) ||
        typeof guess.acceptedAt !== "string"
      ) {
        throw new TypeError(`Daily history guess ${guessIndex + 1} is malformed.`);
      }
      return {
        number: guess.number as number,
        guess: guess.guess,
        pattern: guess.pattern,
        acceptedAt: guess.acceptedAt,
      };
    });

    return {
      date: card.date,
      puzzleNumber: integer(card, "puzzleNumber"),
      status: status as DailyHistoryStatus,
      acceptedGuessCount: integer(card, "acceptedGuessCount", 6),
      guesses,
    };
  });

  const currentStreak = integer(value, "currentStreak");
  const highestStreak = integer(value, "highestStreak");
  if (highestStreak < currentStreak) {
    throw new TypeError("Daily history highestStreak cannot be below currentStreak.");
  }

  return {
    wins: integer(value, "wins"),
    missed: integer(value, "missed"),
    failed: integer(value, "failed"),
    currentStreak,
    highestStreak,
    cards,
  };
}
