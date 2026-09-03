"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import styles from "@/components/profile/profile.module.css";
import { GameBoard, type BoardTile } from "@/components/ui/game-board";
import { dailyPatternEvaluation } from "@/lib/daily";
import type { DailyHistoryCard } from "@/lib/daily-history";

export type DisplayDailyHistoryCard = Omit<DailyHistoryCard, "guesses"> & {
  lettersHidden?: boolean;
  guesses: Array<Omit<DailyHistoryCard["guesses"][number], "guess"> & { guess: string | null }>;
};

const statusLabels: Record<DailyHistoryCard["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  win: "Win",
  failed: "Failed",
  missed: "Missed",
  voided: "Voided",
};

function cardTiles(card: DisplayDailyHistoryCard): BoardTile[] {
  return card.guesses.flatMap((guess) => {
    const evaluation = dailyPatternEvaluation(guess.pattern);
    return (guess.guess ?? "     ").split("").map((letter, index) => ({
      letter,
      state: evaluation[index],
    }));
  });
}

function readableDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function DailyHistoryStrip({ cards }: { cards: DisplayDailyHistoryCard[] }) {
  const strip = useRef<HTMLDivElement>(null);

  function move(direction: -1 | 1) {
    strip.current?.scrollBy({ left: direction * 250, behavior: "smooth" });
  }

  if (cards.length === 0) {
    return <div className={styles.emptyCard}>Your Daily Wordle activity will appear here.</div>;
  }

  return (
    <div className={styles.dailyStrip}>
      <button
        className={styles.arrowButton}
        type="button"
        onClick={() => move(-1)}
        aria-label="Previous Daily Wordle activity"
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <div className={styles.dailyCards} ref={strip}>
        {cards.map((card) => (
          <article className={styles.dailyCard} key={card.date} data-status={card.status}>
            <header>
              <div>
                <strong>Daily #{card.puzzleNumber.toLocaleString("en-US")}</strong>
                <span>{readableDate(card.date)}</span>
              </div>
              <span className={styles.dailyStatus}>{statusLabels[card.status]}</span>
            </header>
            <GameBoard
              compact
              tiles={cardTiles(card)}
              label={`Daily Wordle ${card.puzzleNumber} ${statusLabels[card.status]} board`}
            />
            <small>
              {card.lettersHidden
                ? "Letters available after you finish today’s Wordle"
                : card.status === "missed" || card.status === "voided"
                  ? statusLabels[card.status]
                  : `${card.acceptedGuessCount}/6 attempts`}
            </small>
          </article>
        ))}
      </div>
      <button
        className={styles.arrowButton}
        type="button"
        onClick={() => move(1)}
        aria-label="Next Daily Wordle activity"
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}
