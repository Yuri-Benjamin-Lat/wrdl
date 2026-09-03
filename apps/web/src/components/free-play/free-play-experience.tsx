"use client";

import {
  WORDLE_RULES,
  evaluateGuess,
  isSolved,
  mergeKeyboardEvaluation,
  validateGuess,
  type TileEvaluation,
  type WordRarity,
} from "@wrdl/game-core";
import { Check, CircleHelp, LogOut, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { WrdlLogo } from "@/components/brand/wrdl-logo";
import { Button } from "@/components/ui/button";
import { GameBoard, type BoardTile } from "@/components/ui/game-board";
import { Keyboard } from "@/components/ui/keyboard";
import styles from "./free-play.module.css";

type Stage = "setup" | "loading" | "playing" | "result";
type RoundResult = "playing" | "won" | "lost";
type AcceptedGuess = { word: string; evaluation: TileEvaluation[] };
type RoundState = {
  answer: string;
  rarity: WordRarity;
  acceptedWords: string[];
  guesses: AcceptedGuess[];
  input: string;
  result: RoundResult;
};

type RoundResponse = {
  answer: string;
  rarity: WordRarity;
  acceptedWords: string[];
  message?: string;
};

const warningKey = "wrdl-free-play-warning-suppressed-until";
const tutorialKey = "wrdl-free-play-tutorial-seen";
const startedKey = "wrdl-free-play-started";

function titleCase(value: string) {
  return `${value.slice(0, 1).toLocaleUpperCase("en-US")}${value.slice(1)}`;
}

function playTone(enabled: boolean, success: boolean) {
  if (!enabled || typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = success ? 620 : 180;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.15);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.16);
  oscillator.addEventListener("ended", () => void context.close());
}

function buildTiles(round: RoundState | null): BoardTile[] {
  if (!round) return [];
  const tiles: BoardTile[] = [];

  round.guesses.forEach(({ word, evaluation }) => {
    word.split("").forEach((letter, index) => {
      tiles.push({ letter, state: evaluation[index] });
    });
  });

  if (round.result === "playing") {
    const activeRow = round.guesses.length;
    for (let index = 0; index < WORDLE_RULES.wordLength; index += 1) {
      const letter = round.input[index];
      tiles.push({
        letter,
        state: letter ? "filled" : "empty",
        active: index === round.input.length && round.input.length < WORDLE_RULES.wordLength,
      });
    }
    while (tiles.length < activeRow * WORDLE_RULES.wordLength) tiles.push({ state: "empty" });
  }

  return tiles;
}

function Confetti() {
  return (
    <div className={styles.confetti} aria-hidden="true">
      {Array.from({ length: 42 }, (_, index) => {
        const confettiStyle = {
          "--confetti-x": `${(index * 37) % 100}%`,
          "--confetti-delay": `${(index % 9) * 55}ms`,
          "--confetti-duration": `${1100 + ((index * 83) % 650)}ms`,
          "--confetti-turn": `${index % 2 === 0 ? 1 : -1}`,
          "--confetti-fade": `${680 + ((index * 61) % 700)}ms`,
        } as CSSProperties;
        return <i style={confettiStyle} key={index} />;
      })}
    </div>
  );
}

export function FreePlayExperience({
  initialIncludeRare,
  soundEnabled,
}: {
  initialIncludeRare: boolean;
  soundEnabled: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("setup");
  const [includeRare, setIncludeRare] = useState(initialIncludeRare);
  const [round, setRound] = useState<RoundState | null>(null);
  const [message, setMessage] = useState("");
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [suppressWarning, setSuppressWarning] = useState(false);
  const autoStarted = useRef(false);

  const acceptedWords = useMemo(() => new Set(round?.acceptedWords ?? []), [round?.acceptedWords]);
  const tiles = useMemo(() => buildTiles(round), [round]);
  const keyboardStates = useMemo(
    () =>
      (round?.guesses ?? []).reduce<Record<string, TileEvaluation>>(
        (states, guess) => mergeKeyboardEvaluation(states, guess.word, guess.evaluation),
        {},
      ),
    [round?.guesses],
  );
  const hasProgress =
    stage === "playing" && Boolean(round && (round.guesses.length > 0 || round.input.length > 0));

  const startRound = useCallback(
    async (previousAnswer?: string) => {
      setStage("loading");
      setMessage("");
      try {
        const response = await fetch("/api/free-play/round", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ includeRare, previousAnswer }),
        });
        const data = (await response.json()) as RoundResponse;
        if (!response.ok) throw new Error(data.message || "Unable to start Free Play.");

        setRound({
          answer: data.answer,
          rarity: data.rarity,
          acceptedWords: data.acceptedWords,
          guesses: [],
          input: "",
          result: "playing",
        });
        sessionStorage.setItem(startedKey, "1");
        setStage("playing");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to start Free Play.");
        setStage(previousAnswer ? "result" : "setup");
      }
    },
    [includeRare],
  );

  useEffect(() => {
    const initializeTimer = window.setTimeout(() => {
      if (!localStorage.getItem(tutorialKey)) setTutorialOpen(true);
      if (sessionStorage.getItem(startedKey) === "1" && !autoStarted.current) {
        autoStarted.current = true;
        void startRound();
      }
    }, 0);

    return () => {
      window.clearTimeout(initializeTimer);
    };
  }, [startRound]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasProgress) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasProgress]);

  const triggerShake = useCallback((row: number, text: string) => {
    setMessage(text);
    setShakeRow(row);
    window.setTimeout(() => setShakeRow(null), 320);
  }, []);

  const handleKey = useCallback(
    (key: string) => {
      if (!round || round.result !== "playing" || stage !== "playing" || leaveOpen) return;

      if (key === "Backspace") {
        setRound({ ...round, input: round.input.slice(0, -1) });
        setMessage("");
        return;
      }

      if (key === "Enter") {
        const validation = validateGuess(round.input, acceptedWords);
        if (!validation.valid) {
          triggerShake(
            round.guesses.length,
            validation.reason === "length" ? "Not enough letters" : "Not in word list",
          );
          playTone(soundEnabled, false);
          return;
        }

        const evaluation = evaluateGuess(round.answer, validation.word);
        const guesses = [...round.guesses, { word: validation.word, evaluation }];
        const solved = isSolved(evaluation);
        const exhausted = guesses.length === WORDLE_RULES.guessesPerGame;
        const result: RoundResult = solved ? "won" : exhausted ? "lost" : "playing";
        const acceptedRow = round.guesses.length;
        setRound({ ...round, guesses, input: "", result });
        setRevealRow(acceptedRow);
        window.setTimeout(() => setRevealRow(null), 850);
        setMessage("");
        playTone(soundEnabled, solved);
        if (result !== "playing") window.setTimeout(() => setStage("result"), 850);
        return;
      }

      if (/^[a-z]$/i.test(key) && round.input.length < WORDLE_RULES.wordLength) {
        setRound({ ...round, input: `${round.input}${key.toLocaleLowerCase("en-US")}` });
        setMessage("");
      }
    },
    [acceptedWords, leaveOpen, round, soundEnabled, stage, triggerShake],
  );

  useEffect(() => {
    const handlePhysicalKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key === "Enter" || event.key === "Backspace" || /^[a-z]$/i.test(event.key)) {
        event.preventDefault();
        handleKey(event.key);
      }
    };
    window.addEventListener("keydown", handlePhysicalKey);
    return () => window.removeEventListener("keydown", handlePhysicalKey);
  }, [handleKey]);

  useEffect(() => {
    if (!leaveOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLeaveOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [leaveOpen]);

  function dismissTutorial() {
    localStorage.setItem(tutorialKey, "1");
    setTutorialOpen(false);
  }

  function exitFreePlay() {
    const suppressedUntil = Number(localStorage.getItem(warningKey) ?? 0);
    if (hasProgress && suppressedUntil < Date.now()) {
      setLeaveOpen(true);
      return;
    }
    sessionStorage.removeItem(startedKey);
    router.push("/");
  }

  function confirmLeave() {
    if (suppressWarning) {
      localStorage.setItem(warningKey, String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    }
    sessionStorage.removeItem(startedKey);
    router.push("/");
  }

  return (
    <main className={styles.page}>
      <section className={`${styles.screen} ${stage === "result" ? styles.resultScreen : ""}`}>
        <header className={styles.header}>
          <WrdlLogo size="small" />
          <strong>Free Play</strong>
          <button className={styles.exit} type="button" onClick={exitFreePlay}>
            <LogOut aria-hidden="true" />
            <span>Exit</span>
          </button>
        </header>

        {stage === "setup" ? (
          <section className={styles.setup}>
            <div className={styles.setupIntro}>
              <div>
                <h1>Choose your word pool</h1>
                <p>Build the mix you want to practice.</p>
              </div>
              <button
                className={styles.infoButton}
                type="button"
                aria-label="Explain word pools"
                onClick={() => setTutorialOpen((open) => !open)}
              >
                <CircleHelp aria-hidden="true" />
              </button>
            </div>

            {tutorialOpen ? (
              <aside className={styles.tutorial}>
                <p>
                  Common uses Wordle&apos;s answer list. Rare expands the pool to every word Wordle
                  accepts as a guess.
                </p>
                <button type="button" onClick={dismissTutorial}>
                  Got it
                </button>
              </aside>
            ) : null}

            <div className={styles.poolList}>
              <button className={`${styles.pool} ${styles.selected}`} type="button" aria-pressed>
                <span className={styles.poolLetter}>C</span>
                <span className={styles.poolCopy}>
                  <strong>Common</strong>
                  <span>Everyday words · base pool</span>
                </span>
                <span className={styles.poolCheck}>
                  <Check aria-hidden="true" />
                </span>
              </button>
              <button
                className={`${styles.pool} ${includeRare ? styles.selected : ""}`}
                type="button"
                aria-pressed={includeRare}
                onClick={() => setIncludeRare((enabled) => !enabled)}
              >
                <span className={`${styles.poolLetter} ${styles.rareLetter}`}>R</span>
                <span className={styles.poolCopy}>
                  <strong>Rare</strong>
                  <span>Every accepted Wordle word</span>
                </span>
                <span className={styles.poolCheck}>
                  <Check aria-hidden="true" />
                </span>
              </button>
            </div>
            {message ? <p className={styles.error}>{message}</p> : null}
            <div className={styles.setupActions}>
              <Button onClick={() => void startRound()}>Start</Button>
            </div>
          </section>
        ) : null}

        {stage === "loading" ? (
          <section className={styles.loading} aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            <p>Choosing a word…</p>
          </section>
        ) : null}

        {stage === "playing" && round ? (
          <section className={styles.game}>
            <div className={styles.meta}>{titleCase(round.rarity)}</div>
            <div className={styles.playArea}>
              <GameBoard
                tiles={tiles}
                shakeRow={shakeRow}
                revealRow={revealRow}
                label="Free Play board"
              />
              <p className={styles.message} aria-live="polite">
                {message}
              </p>
              <Keyboard onKey={handleKey} letterStates={keyboardStates} />
            </div>
          </section>
        ) : null}

        {stage === "result" && round ? (
          <section className={styles.resultLayout}>
            {round.result === "won" ? <Confetti /> : null}
            <GameBoard tiles={tiles} label="Complete Free Play result board" />
            <div className={styles.resultPanel}>
              <div className={styles.resultHead}>
                <div className={styles.resultTitle}>
                  {round.result === "won" ? (
                    <Check className={styles.winIcon} aria-hidden="true" />
                  ) : (
                    <X className={styles.failIcon} aria-hidden="true" />
                  )}
                  <h1>{round.result === "won" ? "You got it!" : "Failed"}</h1>
                </div>
                <p>Free Play · {round.result === "won" ? `${round.guesses.length}/6` : "X/6"}</p>
              </div>
              <div className={styles.resultDetails}>
                <div>
                  <span>Answer</span>
                  <strong>{round.answer.toLocaleUpperCase("en-US")}</strong>
                </div>
                <div>
                  <span>Word type</span>
                  <strong>{titleCase(round.rarity)}</strong>
                </div>
              </div>
              {message ? <p className={styles.error}>{message}</p> : null}
              <Button fullWidth onClick={() => void startRound(round.answer)}>
                Next Word
              </Button>
            </div>
          </section>
        ) : null}
      </section>

      {leaveOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={() => setLeaveOpen(false)}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="leave-title">Leave this game?</h2>
            <p>Your current Free Play progress will be lost.</p>
            <label>
              <input
                type="checkbox"
                checked={suppressWarning}
                onChange={(event) => setSuppressWarning(event.target.checked)}
              />
              Don&apos;t show this again for 30 days
            </label>
            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={() => setLeaveOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmLeave}>Leave</Button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
