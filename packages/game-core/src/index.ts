export const WORDLE_RULES = {
  wordLength: 5,
  guessesPerGame: 6,
  maximumBattlePlayers: 8,
} as const;

export * from "./daily";

export type TileEvaluation = "absent" | "present" | "correct";
export type WordRarity = "common" | "rare";

export type GuessValidation =
  { valid: true; word: string } | { valid: false; reason: "length" | "characters" | "not-allowed" };

const evaluationPriority: Record<TileEvaluation, number> = {
  absent: 0,
  present: 1,
  correct: 2,
};

export function normalizeWord(value: string) {
  return value.toLocaleLowerCase("en-US");
}

export function isFiveLetterWord(value: string) {
  return /^[a-z]{5}$/i.test(value);
}

export function validateGuess(value: string, allowedWords?: ReadonlySet<string>): GuessValidation {
  if (value.length !== WORDLE_RULES.wordLength) {
    return { valid: false, reason: "length" };
  }

  if (!isFiveLetterWord(value)) {
    return { valid: false, reason: "characters" };
  }

  const word = normalizeWord(value);
  if (allowedWords && !allowedWords.has(word)) {
    return { valid: false, reason: "not-allowed" };
  }

  return { valid: true, word };
}

export function evaluateGuess(answerValue: string, guessValue: string): TileEvaluation[] {
  if (!isFiveLetterWord(answerValue) || !isFiveLetterWord(guessValue)) {
    throw new RangeError("Wordle answers and guesses must contain exactly five letters.");
  }

  const answer = normalizeWord(answerValue).split("");
  const guess = normalizeWord(guessValue).split("");
  const result = Array<TileEvaluation>(WORDLE_RULES.wordLength).fill("absent");
  const consumedAnswerLetters = Array<boolean>(WORDLE_RULES.wordLength).fill(false);

  for (let index = 0; index < WORDLE_RULES.wordLength; index += 1) {
    if (guess[index] === answer[index]) {
      result[index] = "correct";
      consumedAnswerLetters[index] = true;
    }
  }

  for (let guessIndex = 0; guessIndex < WORDLE_RULES.wordLength; guessIndex += 1) {
    if (result[guessIndex] === "correct") continue;

    const matchingAnswerIndex = answer.findIndex(
      (letter, answerIndex) => !consumedAnswerLetters[answerIndex] && letter === guess[guessIndex],
    );

    if (matchingAnswerIndex !== -1) {
      result[guessIndex] = "present";
      consumedAnswerLetters[matchingAnswerIndex] = true;
    }
  }

  return result;
}

export function isSolved(evaluation: readonly TileEvaluation[]) {
  return (
    evaluation.length === WORDLE_RULES.wordLength &&
    evaluation.every((state) => state === "correct")
  );
}

export function mergeKeyboardEvaluation(
  current: Readonly<Record<string, TileEvaluation>>,
  guessValue: string,
  evaluation: readonly TileEvaluation[],
) {
  if (!isFiveLetterWord(guessValue) || evaluation.length !== WORDLE_RULES.wordLength) {
    throw new RangeError("Keyboard feedback requires one evaluation per guessed letter.");
  }

  const next = { ...current };
  normalizeWord(guessValue)
    .split("")
    .forEach((letter, index) => {
      const incoming = evaluation[index];
      const previous = next[letter];
      if (!previous || evaluationPriority[incoming] > evaluationPriority[previous]) {
        next[letter] = incoming;
      }
    });

  return next;
}
