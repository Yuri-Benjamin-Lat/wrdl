import { ChevronDown } from "lucide-react";

import type { PlayerBattleHistory } from "@/lib/battle-history";
import { Avatar } from "@/components/ui/avatar";
import styles from "./profile.module.css";

function ordinal(value: number) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}:${remainder.toString().padStart(2, "0")} min` : `${minutes} min`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

export function BattleHistoryList({ history }: { history: PlayerBattleHistory }) {
  if (!history.matches.length) {
    return (
      <div className={`${styles.contentBox} ${styles.historyBox}`}>
        <p className={styles.historyEmpty}>No friendly battles yet.</p>
      </div>
    );
  }

  return (
    <div className={styles.battleHistoryList}>
      {history.matches.map((match) => {
        const result =
          match.playerCount === 2
            ? match.completionReason === "forfeit"
              ? `${match.result === "win" ? "Win" : "Loss"} · Forfeit`
              : `${match.result === "win" ? "Win" : "Loss"} · ${match.scoreLine}`
            : `${ordinal(match.placement)} place`;
        return (
          <details className={styles.battleHistoryCard} key={match.id}>
            <summary className={styles.battleHistorySummary}>
              <span className={styles.historyResult}>
                <strong className={match.result === "win" ? styles.battleWin : undefined}>
                  {result}
                </strong>
                {match.completionReason === "forfeit" ? (
                  <small className={styles.forfeitReason}>
                    {match.result === "win" ? "Opponent disconnected" : "You disconnected"}
                  </small>
                ) : null}
              </span>
              <time dateTime={match.completedAt}>{formatDate(match.completedAt)}</time>
              <span>{match.playerCount} players</span>
              <span>
                {match.rounds} rounds · {formatTimer(match.roundTimerSeconds)}
              </span>
              <span className={styles.standingsToggle}>
                View standings <ChevronDown aria-hidden="true" />
              </span>
            </summary>
            <div className={styles.battleStandings}>
              {match.standings.map((standing, index) => (
                <div
                  className={`${styles.battleStandingRow} ${standing.isProfileOwner ? styles.battleStandingOwner : ""}`}
                  key={`${match.id}-${standing.playerId ?? "deleted"}-${index}`}
                >
                  <strong>#{standing.rank}</strong>
                  <Avatar name={standing.displayName} imageUrl={standing.avatarUrl} size="small" />
                  <span className={styles.battleStandingIdentity}>
                    <strong>
                      {standing.displayName}
                      {standing.isProfileOwner ? " · You" : ""}
                    </strong>
                    {standing.username ? <small>@{standing.username}</small> : null}
                  </span>
                  <strong>{standing.points} pts</strong>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
