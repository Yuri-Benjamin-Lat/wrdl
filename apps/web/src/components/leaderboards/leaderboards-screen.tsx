"use client";

import { ArrowLeft, Flame, Globe2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { LeaderboardPayload, LeaderboardPlayer, LeaderboardScope } from "@/lib/leaderboard";
import { streakHue } from "@/lib/profile";
import { Avatar } from "@/components/ui/avatar";
import styles from "./leaderboards.module.css";

function ordinal(rank: number) {
  const lastTwo = rank % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${rank}th`;
  if (rank % 10 === 1) return `${rank}st`;
  if (rank % 10 === 2) return `${rank}nd`;
  if (rank % 10 === 3) return `${rank}rd`;
  return `${rank}th`;
}

function Streak({ value }: { value: number }) {
  const color = value > 0 ? `hsl(${streakHue(value)} 68% 47%)` : "var(--muted)";
  return (
    <strong className={styles.streak} style={{ color }}>
      {value > 0 ? <Flame aria-hidden="true" /> : null}
      {value}
    </strong>
  );
}

function PlayerEntry({
  player,
  scope,
  pinned = false,
}: {
  player: LeaderboardPlayer;
  scope: LeaderboardScope;
  pinned?: boolean;
}) {
  return (
    <Link
      className={`${styles.player} ${player.isViewer ? styles.viewer : ""} ${pinned ? styles.pinnedPlayer : ""}`}
      href={
        player.isViewer
          ? "/profile"
          : `/profile/${player.username}?from=leaderboards&scope=${scope}`
      }
    >
      {pinned ? <b className={styles.pinnedRank}>#{player.rank}</b> : null}
      <Avatar name={player.displayName} imageUrl={player.avatarUrl} />
      <span className={styles.identity}>
        <strong>{player.displayName}</strong>
        <small>
          @{player.username}
          {player.isViewer ? " · You" : ""}
        </small>
      </span>
      {pinned ? <Streak value={player.streak} /> : null}
    </Link>
  );
}

export function LeaderboardsScreen({
  initialGlobal,
  initialFriends,
  initialScope,
}: {
  initialGlobal: LeaderboardPayload;
  initialFriends: LeaderboardPayload;
  initialScope: LeaderboardScope;
}) {
  const [scope, setScope] = useState<LeaderboardScope>(initialScope);
  const [data, setData] = useState<Record<LeaderboardScope, LeaderboardPayload>>({
    global: initialGlobal,
    friends: initialFriends,
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refresh = async () => {
      try {
        const response = await fetch(`/api/leaderboards?scope=${scope}`);
        if (!response.ok) throw new Error();
        const payload = (await response.json()) as LeaderboardPayload;
        setData((current) => ({ ...current, [scope]: payload }));
        setMessage("");
      } catch {
        setMessage("Rankings will retry automatically.");
      }
    };
    const interval = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(interval);
  }, [scope]);

  const current = data[scope];
  const groups = useMemo(() => {
    const grouped = new Map<number, LeaderboardPlayer[]>();
    for (const player of current.items) {
      const existing = grouped.get(player.rank) ?? [];
      existing.push(player);
      grouped.set(player.rank, existing);
    }
    return [...grouped.entries()];
  }, [current.items]);

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Leaderboards</h1>
        <Link className={styles.exit} href="/">
          <ArrowLeft aria-hidden="true" />
          Exit
        </Link>
      </header>
      <div className={styles.tabs} aria-label="Leaderboard sections">
        <button
          className={scope === "global" ? styles.activeTab : styles.tab}
          type="button"
          aria-label="Global leaderboard"
          aria-pressed={scope === "global"}
          onClick={() => setScope("global")}
        >
          <Globe2 aria-hidden="true" />
        </button>
        <button
          className={scope === "friends" ? styles.activeTab : styles.tab}
          type="button"
          aria-label="Friends leaderboard"
          aria-pressed={scope === "friends"}
          onClick={() => setScope("friends")}
        >
          <UsersRound aria-hidden="true" />
        </button>
      </div>

      <div className={styles.rankingViewport}>
        <div className={styles.rankingList}>
          {groups.map(([rank, players]) => (
            <article
              className={`${styles.rankGroup} ${rank <= 3 ? styles[`rank${rank}`] : ""} ${players.some((player) => player.isViewer) ? styles.viewerGroup : ""}`}
              key={rank}
            >
              <strong className={styles.rankLabel}>{ordinal(rank)}</strong>
              <div className={styles.players}>
                {players.map((player) => (
                  <PlayerEntry player={player} scope={scope} key={player.id} />
                ))}
              </div>
              <div className={styles.groupStreak}>
                <Streak value={players[0]!.streak} />
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className={styles.pinned} aria-label="Your current rank">
        <PlayerEntry player={current.viewer} scope={scope} pinned />
      </div>
      {message ? <p className={styles.message}>{message}</p> : null}
    </section>
  );
}
