import type { WrdlAudience } from "./database.types";
import type { DisplayDailyHistoryCard } from "@/components/profile/daily-history-strip";
import type { BattleStatistics } from "./battle-history";
import { parseSocialPlayer, type SocialPlayer } from "./social";

export type PlayerDailyStatistics = {
  wins: number;
  missed: number;
  failed: number;
  currentStreak: number;
  highestStreak: number;
  battles: BattleStatistics;
};

export type PlayerProfile = SocialPlayer & {
  bio: string | null;
  experience: number;
  experienceCap: number;
  isOwner: boolean;
  isFriend: boolean;
  dailyHistoryVisible: boolean;
  statisticsVisible: boolean;
  battleHistoryVisible: boolean;
  dailyHistoryAudience: WrdlAudience | null;
  statisticsAudience: WrdlAudience | null;
  battleHistoryAudience: WrdlAudience | null;
  statistics: PlayerDailyStatistics | null;
};

export type PlayerDailyHistory = {
  visible: boolean;
  cards: DisplayDailyHistoryCard[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(record: Record<string, unknown>, key: string, max?: number) {
  const value = record[key];
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (max !== undefined && (value as number) > max)
  ) {
    throw new TypeError(`Player profile has an invalid ${key}.`);
  }
  return value as number;
}

function audience(value: unknown) {
  return value === "public" || value === "friends" || value === "none" ? value : null;
}

export function parsePlayerProfile(value: unknown): PlayerProfile {
  if (!isRecord(value)) throw new TypeError("Player profile must be an object.");
  const social = parseSocialPlayer(value);
  if (
    typeof value.isOwner !== "boolean" ||
    typeof value.isFriend !== "boolean" ||
    typeof value.dailyHistoryVisible !== "boolean" ||
    typeof value.statisticsVisible !== "boolean" ||
    typeof value.battleHistoryVisible !== "boolean"
  ) {
    throw new TypeError("Player profile has invalid privacy state.");
  }

  let statistics: PlayerDailyStatistics | null = null;
  if (value.statisticsVisible) {
    if (!isRecord(value.statistics)) throw new TypeError("Visible statistics are missing.");
    statistics = {
      wins: integer(value.statistics, "wins"),
      missed: integer(value.statistics, "missed"),
      failed: integer(value.statistics, "failed"),
      currentStreak: integer(value.statistics, "currentStreak"),
      highestStreak: integer(value.statistics, "highestStreak"),
      battles: parseBattleStatistics(value.statistics.battles),
    };
  } else if (value.statistics !== null) {
    throw new TypeError("Private statistics leaked data.");
  }

  return {
    ...social,
    bio: value.bio === null ? null : typeof value.bio === "string" ? value.bio : null,
    experience: integer(value, "experience"),
    experienceCap: integer(value, "experienceCap"),
    isOwner: value.isOwner,
    isFriend: value.isFriend,
    dailyHistoryVisible: value.dailyHistoryVisible,
    statisticsVisible: value.statisticsVisible,
    battleHistoryVisible: value.battleHistoryVisible,
    dailyHistoryAudience: audience(value.dailyHistoryAudience),
    statisticsAudience: audience(value.statisticsAudience),
    battleHistoryAudience: audience(value.battleHistoryAudience),
    statistics,
  };
}

function parseBattleStatistics(value: unknown): BattleStatistics {
  if (!isRecord(value)) throw new TypeError("Visible battle statistics are missing.");
  return {
    twoPlayerWins: integer(value, "twoPlayerWins"),
    twoPlayerLosses: integer(value, "twoPlayerLosses"),
    threePlayerWins: integer(value, "threePlayerWins"),
    threePlayerLosses: integer(value, "threePlayerLosses"),
    fourPlusWins: integer(value, "fourPlusWins"),
    fourPlusLosses: integer(value, "fourPlusLosses"),
  };
}

export function parsePlayerDailyHistory(value: unknown): PlayerDailyHistory {
  if (!isRecord(value) || typeof value.visible !== "boolean" || !Array.isArray(value.cards)) {
    throw new TypeError("Player Daily history must be an object.");
  }
  if (!value.visible && value.cards.length)
    throw new TypeError("Private Daily history leaked cards.");
  if (value.cards.length > 30) throw new TypeError("Player Daily history exceeded 30 cards.");

  const cards = value.cards.map((card, cardIndex): DisplayDailyHistoryCard => {
    if (!isRecord(card) || !Array.isArray(card.guesses)) {
      throw new TypeError(`Player Daily card ${cardIndex + 1} is malformed.`);
    }
    const status = card.status;
    if (
      status !== "not_started" &&
      status !== "in_progress" &&
      status !== "win" &&
      status !== "failed" &&
      status !== "missed" &&
      status !== "voided"
    ) {
      throw new TypeError(`Player Daily card ${cardIndex + 1} has an invalid status.`);
    }
    const lettersHidden = card.lettersHidden === true;
    return {
      date: typeof card.date === "string" ? card.date : "",
      puzzleNumber: integer(card, "puzzleNumber"),
      status,
      acceptedGuessCount: integer(card, "acceptedGuessCount", 6),
      lettersHidden,
      guesses: card.guesses.map((guess) => {
        if (!isRecord(guess)) throw new TypeError("Player Daily guess is malformed.");
        const word = guess.guess;
        if (
          (!lettersHidden && (typeof word !== "string" || !/^[a-z]{5}$/.test(word))) ||
          (lettersHidden && word !== null) ||
          typeof guess.pattern !== "string" ||
          !/^[012]{5}$/.test(guess.pattern) ||
          typeof guess.acceptedAt !== "string"
        ) {
          throw new TypeError("Player Daily guess is malformed.");
        }
        return {
          number: integer(guess, "number", 6),
          guess: word as string | null,
          pattern: guess.pattern,
          acceptedAt: guess.acceptedAt,
        };
      }),
    };
  });

  return { visible: value.visible, cards };
}
