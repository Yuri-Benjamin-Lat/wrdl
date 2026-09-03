export const MANILA_TIME_ZONE = "Asia/Manila";

export type DailyOutcome = "in_progress" | "win" | "failed" | "missed" | "voided";

export type ExperienceProgress = {
  level: number;
  experience: number;
};

function assertDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RangeError("Daily puzzle dates must use YYYY-MM-DD.");
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new RangeError("Daily puzzle date is not a real calendar date.");
  }
}

export function manilaDateKey(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("A valid instant is required.");

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

export function nextManilaReset(dateKey: string) {
  assertDateKey(dateKey);
  const [year, month, day] = dateKey.split("-").map(Number);
  const nextCalendarDay = new Date(Date.UTC(year, month - 1, day + 1));

  return new Date(
    Date.UTC(
      nextCalendarDay.getUTCFullYear(),
      nextCalendarDay.getUTCMonth(),
      nextCalendarDay.getUTCDate(),
      -8,
    ),
  );
}

export function isDailyPlayable(eligibilityDate: string, puzzleDate: string) {
  assertDateKey(eligibilityDate);
  assertDateKey(puzzleDate);
  return puzzleDate >= eligibilityDate;
}

export function countsAsMissedWhenUnplayed(eligibilityDate: string, puzzleDate: string) {
  assertDateKey(eligibilityDate);
  assertDateKey(puzzleDate);
  return puzzleDate > eligibilityDate;
}

export function dailyExperienceAward(outcome: DailyOutcome) {
  if (outcome === "win") return 20;
  if (outcome === "failed") return 5;
  return 0;
}

export function experienceRequiredForLevel(level: number) {
  if (!Number.isSafeInteger(level) || level < 1) {
    throw new RangeError("Level must be a positive integer.");
  }

  const required = 20 * 2 ** (level - 1);
  if (!Number.isSafeInteger(required)) {
    throw new RangeError("Level experience requirement exceeds safe integer precision.");
  }
  return required;
}

export function applyExperience(
  current: Readonly<ExperienceProgress>,
  award: number,
): ExperienceProgress {
  if (!Number.isSafeInteger(current.level) || current.level < 1) {
    throw new RangeError("Level must be a positive integer.");
  }
  if (!Number.isSafeInteger(current.experience) || current.experience < 0) {
    throw new RangeError("Experience must be a non-negative integer.");
  }
  if (!Number.isSafeInteger(award) || award < 0) {
    throw new RangeError("Experience award must be a non-negative integer.");
  }

  let level = current.level;
  let experience = current.experience + award;
  let required = experienceRequiredForLevel(level);

  while (experience >= required) {
    experience -= required;
    level += 1;
    required = experienceRequiredForLevel(level);
  }

  return { level, experience };
}
