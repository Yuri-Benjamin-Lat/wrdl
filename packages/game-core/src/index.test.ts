import { describe, expect, it } from "vitest";

import {
  WORDLE_RULES,
  evaluateGuess,
  isFiveLetterWord,
  isSolved,
  mergeKeyboardEvaluation,
  normalizeWord,
  validateGuess,
  type TileEvaluation,
} from "./index";

describe("shared WRDL rules", () => {
  it("uses the approved board and battle limits", () => {
    expect(WORDLE_RULES).toEqual({
      wordLength: 5,
      guessesPerGame: 6,
      maximumBattlePlayers: 8,
    });
  });
});

describe("word validation", () => {
  it.each(["crane", "CRANE", "CrAnE"])("accepts five ASCII letters: %s", (word) => {
    expect(isFiveLetterWord(word)).toBe(true);
  });

  it.each(["four", "longer", "a b c", "caféx", "12345", ""])(
    "rejects malformed input: %s",
    (word) => {
      expect(isFiveLetterWord(word)).toBe(false);
    },
  );

  it("normalizes accepted guesses and checks the broader guess catalog", () => {
    const accepted = new Set(["crane", "slate"]);

    expect(validateGuess("CRANE", accepted)).toEqual({ valid: true, word: "crane" });
    expect(validateGuess("short", accepted)).toEqual({
      valid: false,
      reason: "not-allowed",
    });
    expect(validateGuess("four", accepted)).toEqual({ valid: false, reason: "length" });
    expect(validateGuess("ab-cd", accepted)).toEqual({
      valid: false,
      reason: "characters",
    });
    expect(normalizeWord("CrAnE")).toBe("crane");
  });
});

describe("two-pass Wordle evaluation", () => {
  const cases: Array<{
    answer: string;
    guess: string;
    expected: TileEvaluation[];
  }> = [
    {
      answer: "crane",
      guess: "crane",
      expected: ["correct", "correct", "correct", "correct", "correct"],
    },
    {
      answer: "crane",
      guess: "sloth",
      expected: ["absent", "absent", "absent", "absent", "absent"],
    },
    {
      answer: "crane",
      guess: "react",
      expected: ["present", "present", "correct", "present", "absent"],
    },
    {
      answer: "apple",
      guess: "allee",
      expected: ["correct", "present", "absent", "absent", "correct"],
    },
    {
      answer: "array",
      guess: "rarer",
      expected: ["present", "present", "correct", "absent", "absent"],
    },
    {
      answer: "sassy",
      guess: "assay",
      expected: ["present", "present", "correct", "absent", "correct"],
    },
    {
      answer: "civic",
      guess: "vivid",
      expected: ["absent", "correct", "correct", "correct", "absent"],
    },
    {
      answer: "belle",
      guess: "eerie",
      expected: ["absent", "correct", "absent", "absent", "correct"],
    },
  ];

  it.each(cases)("evaluates $guess against $answer", ({ answer, guess, expected }) => {
    expect(evaluateGuess(answer, guess)).toEqual(expected);
  });

  it("rejects malformed answers and guesses", () => {
    expect(() => evaluateGuess("four", "crane")).toThrow(RangeError);
    expect(() => evaluateGuess("crane", "sixsix")).toThrow(RangeError);
  });

  it("recognizes only a complete all-correct row as solved", () => {
    expect(isSolved(evaluateGuess("crane", "crane"))).toBe(true);
    expect(isSolved(evaluateGuess("crane", "react"))).toBe(false);
    expect(isSolved(["correct"])).toBe(false);
  });
});

describe("keyboard feedback", () => {
  it("keeps the strongest known result for every letter", () => {
    const first = mergeKeyboardEvaluation({}, "civic", [
      "absent",
      "present",
      "correct",
      "present",
      "absent",
    ]);
    const second = mergeKeyboardEvaluation(first, "vivid", [
      "present",
      "correct",
      "absent",
      "correct",
      "absent",
    ]);

    expect(second).toEqual({ c: "absent", i: "correct", v: "correct", d: "absent" });
  });

  it("rejects incomplete keyboard updates", () => {
    expect(() => mergeKeyboardEvaluation({}, "crane", ["correct"])).toThrow(RangeError);
  });
});
