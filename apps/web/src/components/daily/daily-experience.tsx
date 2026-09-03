"use client";

import {
  WORDLE_RULES,
  mergeKeyboardEvaluation,
  validateGuess,
  type TileEvaluation,
} from "@wrdl/game-core";
import { Check, Download, LogOut, Share2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { WrdlLogo } from "@/components/brand/wrdl-logo";
import { Button } from "@/components/ui/button";
import { GameBoard, type BoardTile } from "@/components/ui/game-board";
import { Keyboard } from "@/components/ui/keyboard";
import {
  dailyPatternEvaluation,
  formatDailyCountdown,
  parseDailySnapshot,
  type DailySnapshot,
} from "@/lib/daily";
import {
  createDailyShareModel,
  downloadDailySharePng,
  renderDailySharePng,
} from "@/lib/daily-share";
import styles from "./daily.module.css";

type PendingCommand = { id: string; guess: string };
type ApiMessage = { message?: string };

function playTone(enabled: boolean, success: boolean) {
  if (!enabled || typeof window === "undefined" || !window.AudioContext) return;
  const context = new window.AudioContext();
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

function buildTiles(snapshot: DailySnapshot | null, input: string): BoardTile[] {
  const tiles: BoardTile[] = [];
  for (const accepted of snapshot?.guesses ?? []) {
    const evaluation = dailyPatternEvaluation(accepted.pattern);
    accepted.guess.split("").forEach((letter, index) => {
      tiles.push({ letter, state: evaluation[index] });
    });
  }

  if (snapshot && ["not_started", "in_progress"].includes(snapshot.status)) {
    for (let index = 0; index < WORDLE_RULES.wordLength; index += 1) {
      const letter = input[index];
      tiles.push({
        letter,
        state: letter ? "filled" : "empty",
        active: index === input.length && input.length < WORDLE_RULES.wordLength,
      });
    }
  }
  return tiles;
}

function Confetti() {
  return (
    <div className={styles.confetti} aria-hidden="true">
      {Array.from({ length: 20 }, (_, index) => (
        <i key={index} />
      ))}
    </div>
  );
}

export function DailyExperience({ soundEnabled }: { soundEnabled: boolean }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<DailySnapshot | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [online, setOnline] = useState(true);
  const [shakeRow, setShakeRow] = useState<number | null>(null);
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [resultVisible, setResultVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<{
    message: string;
    kind: "copied" | "downloaded" | "failed";
  } | null>(null);
  const [clock, setClock] = useState(0);
  const [serverOffset, setServerOffset] = useState(0);
  const pendingCommand = useRef<PendingCommand | null>(null);
  const resetReloading = useRef(false);
  const shareNoticeTimer = useRef<number | null>(null);

  const terminal = snapshot?.status === "win" || snapshot?.status === "failed";
  const countdown = snapshot
    ? formatDailyCountdown(
        new Date(snapshot.resetAt).getTime() -
          (clock ? clock + serverOffset : new Date(snapshot.serverTime).getTime()),
      )
    : "--:--:--";
  const tiles = useMemo(() => buildTiles(snapshot, input), [input, snapshot]);
  const keyboardStates = useMemo(
    () =>
      (snapshot?.guesses ?? []).reduce<Record<string, TileEvaluation>>((states, guess) => {
        return mergeKeyboardEvaluation(states, guess.guess, dailyPatternEvaluation(guess.pattern));
      }, {}),
    [snapshot?.guesses],
  );

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setMessage("");
    try {
      const receivedAt = Date.now();
      const response = await fetch("/api/daily", { cache: "no-store" });
      const body = (await response.json()) as unknown;
      if (!response.ok) {
        const api = body as ApiMessage;
        throw new Error(api.message || "Unable to load today's puzzle.");
      }
      const next = parseDailySnapshot(body);
      setSnapshot(next);
      setServerOffset(new Date(next.serverTime).getTime() - receivedAt);
      setInput("");
      setResultVisible(next.status === "win" || next.status === "failed");
      pendingCommand.current = null;
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
      resetReloading.current = false;
    }
  }, []);

  useEffect(() => {
    const initialize = window.setTimeout(() => {
      setOnline(navigator.onLine);
      void loadSnapshot();
    }, 0);

    const handleOffline = () => {
      setOnline(false);
    };
    const handleOnline = () => {
      setOnline(true);
      void loadSnapshot();
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.clearTimeout(initialize);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [loadSnapshot]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => {
      window.clearInterval(timer);
      if (shareNoticeTimer.current !== null) window.clearTimeout(shareNoticeTimer.current);
    };
  }, []);

  const showShareNotice = useCallback(
    (message: string, kind: "copied" | "downloaded" | "failed") => {
      setShareNotice({ message, kind });
      if (shareNoticeTimer.current !== null) window.clearTimeout(shareNoticeTimer.current);
      shareNoticeTimer.current = window.setTimeout(() => setShareNotice(null), 3200);
    },
    [],
  );

  const shareResults = useCallback(async () => {
    if (!snapshot || !terminal || sharing) return;
    setSharing(true);
    try {
      const model = createDailyShareModel(snapshot);
      const png = await renderDailySharePng(model);
      const canCopyImage =
        typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function";

      if (canCopyImage) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
          showShareNotice("Copied to clipboard", "copied");
          return;
        } catch {
          // Use the same generated image as the required browser fallback.
        }
      }

      downloadDailySharePng(png, model.filename);
      showShareNotice("Image copying isn’t supported here. PNG downloaded instead.", "downloaded");
    } catch {
      showShareNotice("Share Results couldn’t create the image. Please try again.", "failed");
    } finally {
      setSharing(false);
    }
  }, [sharing, showShareNotice, snapshot, terminal]);

  useEffect(() => {
    const resetCheck = window.setTimeout(() => {
      if (!snapshot || resetReloading.current || clock === 0) return;
      if (new Date(snapshot.resetAt).getTime() > clock + serverOffset) return;
      resetReloading.current = true;
      setMessage("Daily Wordle has reset. Loading today’s puzzle…");
      setInput("");
      void loadSnapshot();
    }, 0);
    return () => window.clearTimeout(resetCheck);
  }, [clock, loadSnapshot, serverOffset, snapshot]);

  const shake = useCallback(
    (text: string) => {
      setMessage(text);
      setShakeRow(snapshot?.acceptedGuessCount ?? 0);
      window.setTimeout(() => setShakeRow(null), 320);
    },
    [snapshot?.acceptedGuessCount],
  );

  const submitGuess = useCallback(async () => {
    if (!snapshot || pending || !online) return;
    const validation = validateGuess(input);
    if (!validation.valid) {
      shake(validation.reason === "length" ? "Not enough letters" : "Use letters only");
      playTone(soundEnabled, false);
      return;
    }

    const command =
      pendingCommand.current?.guess === validation.word
        ? pendingCommand.current
        : { id: crypto.randomUUID(), guess: validation.word };
    pendingCommand.current = command;
    setPending(true);
    setMessage("");

    try {
      const response = await fetch("/api/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandId: command.id, guess: command.guess }),
      });
      const body = (await response.json()) as unknown;
      if (!response.ok) {
        const api = body as ApiMessage;
        if (response.status < 500) pendingCommand.current = null;
        shake(api.message || "Unable to submit your guess.");
        playTone(soundEnabled, false);
        return;
      }

      const next = parseDailySnapshot(body);
      const acceptedRow = snapshot.acceptedGuessCount;
      pendingCommand.current = null;
      setSnapshot(next);
      setInput("");
      setRevealRow(acceptedRow);
      setResultVisible(false);
      const won = next.status === "win";
      playTone(soundEnabled, won);
      window.setTimeout(() => {
        setRevealRow(null);
        if (next.status === "win" || next.status === "failed") setResultVisible(true);
      }, 850);
    } catch {
      setMessage("Your guess could not be confirmed. Try again.");
    } finally {
      setPending(false);
    }
  }, [input, online, pending, shake, snapshot, soundEnabled]);

  const handleKey = useCallback(
    (key: string) => {
      if (
        !snapshot ||
        !["not_started", "in_progress"].includes(snapshot.status) ||
        terminal ||
        pending
      ) {
        return;
      }
      if (!online) {
        setMessage("Reconnect to submit Daily Wordle guesses.");
        return;
      }
      if (key === "Backspace") {
        setInput((value) => value.slice(0, -1));
        setMessage("");
      } else if (key === "Enter") {
        void submitGuess();
      } else if (/^[a-z]$/i.test(key) && input.length < WORDLE_RULES.wordLength) {
        setInput((value) => `${value}${key.toLocaleLowerCase("en-US")}`);
        setMessage("");
      }
    },
    [input.length, online, pending, snapshot, submitGuess, terminal],
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

  const exit = () => router.push("/");

  return (
    <main className={styles.page}>
      <section className={`${styles.screen} ${terminal ? styles.resultScreen : ""}`}>
        <header className={styles.header}>
          <WrdlLogo size="small" />
          <strong>Daily Wordle</strong>
          <button className={styles.exit} type="button" onClick={exit}>
            <LogOut aria-hidden="true" />
            <span>Exit</span>
          </button>
        </header>

        {loading && !snapshot ? (
          <section className={styles.loading} aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            <p>Loading today&apos;s puzzle…</p>
          </section>
        ) : null}

        {loadFailed ? (
          <section className={styles.failure}>
            <h1>Unable to load today&apos;s puzzle</h1>
            <p>Check your connection and try again.</p>
            <div>
              <Button onClick={() => void loadSnapshot()}>Try Again</Button>
              <Button variant="secondary" onClick={exit}>
                Exit
              </Button>
            </div>
          </section>
        ) : null}

        {!loading && snapshot?.status === "unavailable" ? (
          <section className={styles.failure}>
            <h1>Today&apos;s puzzle is not available yet</h1>
            <p>Your Daily Wordle progress and permanent numbering are safe.</p>
            <div>
              <Button onClick={() => void loadSnapshot()}>Try Again</Button>
              <Button variant="secondary" onClick={exit}>
                Exit
              </Button>
            </div>
          </section>
        ) : null}

        {!loading && snapshot?.status === "voided" ? (
          <section className={styles.failure}>
            <h1>Today&apos;s puzzle was voided</h1>
            <p>It will not affect your streak, statistics, or EXP.</p>
            <Button variant="secondary" onClick={exit}>
              Exit
            </Button>
          </section>
        ) : null}

        {snapshot && !terminal && ["not_started", "in_progress"].includes(snapshot.status) ? (
          <section className={styles.game}>
            <div className={styles.meta}>Next puzzle {countdown}</div>
            <div className={styles.playArea}>
              <GameBoard
                tiles={tiles}
                shakeRow={shakeRow}
                revealRow={revealRow}
                label={`Daily Wordle ${snapshot.puzzleNumber ?? ""} board`}
              />
              <p className={styles.message} aria-live="polite">
                {message}
              </p>
              <Keyboard
                onKey={handleKey}
                letterStates={keyboardStates}
                disabled={pending || !online}
              />
            </div>
          </section>
        ) : null}

        {snapshot && terminal && resultVisible ? (
          <section className={styles.resultLayout}>
            {snapshot.status === "win" ? <Confetti /> : null}
            <GameBoard tiles={tiles} label="Complete Daily Wordle result board" />
            <div className={styles.resultPanel}>
              <div className={styles.resultHead}>
                <div className={styles.resultTitle}>
                  {snapshot.status === "win" ? (
                    <Check className={styles.winIcon} aria-hidden="true" />
                  ) : (
                    <X className={styles.failIcon} aria-hidden="true" />
                  )}
                  <h1>{snapshot.status === "win" ? "You got it!" : "Failed"}</h1>
                </div>
                <p>
                  Daily Wordle {snapshot.puzzleNumber?.toLocaleString("en-US")} ·{" "}
                  {snapshot.status === "win" ? `${snapshot.acceptedGuessCount}/6` : "X/6"}
                </p>
              </div>
              <div className={styles.resultDetails}>
                <div>
                  <span>Current streak</span>
                  <strong>
                    {snapshot.streak} {snapshot.streak === 1 ? "day" : "days"}
                  </strong>
                </div>
                <div>
                  <span>Next puzzle</span>
                  <strong>{countdown}</strong>
                </div>
              </div>
              <Button
                fullWidth
                icon={<Share2 aria-hidden="true" />}
                disabled={sharing}
                onClick={() => void shareResults()}
              >
                {sharing ? "Preparing image…" : "Share Results"}
              </Button>
            </div>
          </section>
        ) : null}
      </section>
      {shareNotice ? (
        <div
          className={`${styles.shareNotice} ${shareNotice.kind === "failed" ? styles.shareNoticefailed : ""}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">
            {shareNotice.kind === "downloaded" ? (
              <Download />
            ) : shareNotice.kind === "failed" ? (
              <X />
            ) : (
              <Check />
            )}
          </span>
          <strong>{shareNotice.message}</strong>
        </div>
      ) : null}
    </main>
  );
}
