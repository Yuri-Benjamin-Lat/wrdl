import { Swords, Trophy } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { requireCompleteAccount } from "@/lib/auth";
import styles from "./page.module.css";

const dailyColors = [
  "gray",
  "gray",
  "gray",
  "gray",
  "gray",
  "yellow",
  "gray",
  "yellow",
  "gray",
  "gray",
  "green",
  "yellow",
  "green",
  "yellow",
  "green",
  "green",
  "green",
  "green",
  "green",
  "green",
] as const;

export default async function HomePage() {
  const account = await requireCompleteAccount();
  const username = account.profile.username!;
  const displayName = account.profile.display_name || username;
  const shellAccount = {
    displayName,
    username,
    avatarUrl: account.avatarUrl,
    theme: account.settings.theme,
    highContrast: account.settings.high_contrast_tiles,
  };

  return (
    <AppShell account={shellAccount}>
      <section className={styles.home}>
        <header>
          <h1>Choose a game</h1>
          <p>Welcome back, {displayName}.</p>
        </header>
        <div className={styles.grid}>
          <Link className={`${styles.card} ${styles.daily}`} href="/daily">
            <span className={styles.copy}>
              <strong>Daily Wordle</strong>
              <span>Next puzzle 08:42:16</span>
            </span>
            <span className={styles.dailyArt} aria-hidden="true">
              {dailyColors.map((color, index) => (
                <i className={styles[color]} key={index} />
              ))}
            </span>
          </Link>
          <Link className={`${styles.card} ${styles.free}`} href="/free-play">
            <span className={styles.copy}>
              <strong>Free Play</strong>
              <span>Practice freely.</span>
            </span>
            <span className={styles.freeArt} aria-hidden="true">
              <i>W</i>
              <i>R</i>
              <i>D</i>
            </span>
          </Link>
          <Link className={`${styles.card} ${styles.battle}`} href="/battle">
            <span className={styles.copy}>
              <strong>Friendly Battle</strong>
              <span>Play with friends.</span>
            </span>
            <Swords className={styles.largeIcon} aria-hidden="true" />
          </Link>
          <Link className={`${styles.card} ${styles.leaderboard}`} href="/leaderboards">
            <span className={styles.copy}>
              <strong>Leaderboards</strong>
              <span>See the rankings.</span>
            </span>
            <Trophy className={styles.largeIcon} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
