import { describe, expect, it } from "vitest";

import { APP_CONFIG } from "./app-config";

describe("WRDL application rules", () => {
  it("uses the approved core game limits", () => {
    expect(APP_CONFIG.wordLength).toBe(5);
    expect(APP_CONFIG.guessesPerGame).toBe(6);
    expect(APP_CONFIG.maximumBattlePlayers).toBe(8);
  });

  it("resets the Daily Wordle on Philippine time", () => {
    expect(APP_CONFIG.dailyResetTimeZone).toBe("Asia/Manila");
  });
});
