import { describe, expect, it } from "vitest";

import {
  applyExperience,
  countsAsMissedWhenUnplayed,
  dailyExperienceAward,
  experienceRequiredForLevel,
  isDailyPlayable,
  manilaDateKey,
  nextManilaReset,
} from "./daily";

describe("Philippine Daily Wordle calendar", () => {
  it("uses Philippine midnight rather than the device date", () => {
    expect(manilaDateKey("2026-08-28T15:59:59.999Z")).toBe("2026-08-28");
    expect(manilaDateKey("2026-08-28T16:00:00.000Z")).toBe("2026-08-29");
  });

  it("crosses month and year boundaries at the correct UTC instant", () => {
    expect(nextManilaReset("2026-08-31").toISOString()).toBe("2026-08-31T16:00:00.000Z");
    expect(nextManilaReset("2026-12-31").toISOString()).toBe("2026-12-31T16:00:00.000Z");
  });

  it("allows creation-day play but does not count an unplayed creation day as missed", () => {
    expect(isDailyPlayable("2026-08-29", "2026-08-29")).toBe(true);
    expect(countsAsMissedWhenUnplayed("2026-08-29", "2026-08-29")).toBe(false);
    expect(countsAsMissedWhenUnplayed("2026-08-29", "2026-08-30")).toBe(true);
  });

  it("rejects malformed and impossible date keys", () => {
    expect(() => nextManilaReset("2026-02-30")).toThrow(RangeError);
    expect(() => isDailyPlayable("08/29/2026", "2026-08-29")).toThrow(RangeError);
  });
});

describe("Daily Wordle progression", () => {
  it("awards EXP only for wins and failed attempts", () => {
    expect(dailyExperienceAward("win")).toBe(20);
    expect(dailyExperienceAward("failed")).toBe(5);
    expect(dailyExperienceAward("missed")).toBe(0);
    expect(dailyExperienceAward("voided")).toBe(0);
    expect(dailyExperienceAward("in_progress")).toBe(0);
  });

  it("doubles the requirement for every level", () => {
    expect(experienceRequiredForLevel(1)).toBe(20);
    expect(experienceRequiredForLevel(2)).toBe(40);
    expect(experienceRequiredForLevel(3)).toBe(80);
  });

  it("carries a single award across one or more level boundaries", () => {
    expect(applyExperience({ level: 1, experience: 0 }, 20)).toEqual({
      level: 2,
      experience: 0,
    });
    expect(applyExperience({ level: 1, experience: 15 }, 50)).toEqual({
      level: 3,
      experience: 5,
    });
  });
});
