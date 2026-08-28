import { describe, expect, it } from "vitest";

import { WORDLE_RULES } from "./index";

describe("shared WRDL rules", () => {
  it("starts with the approved board and battle limits", () => {
    expect(WORDLE_RULES).toEqual({
      wordLength: 5,
      guessesPerGame: 6,
      maximumBattlePlayers: 8,
    });
  });
});
