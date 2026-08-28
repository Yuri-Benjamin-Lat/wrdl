import { Swords, Trophy } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
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

export default function HomePage() {
  return (
    <AppShell>
      <section className={styles.home}>
        <header>
          <h1>Choose a game</h1>
          <p>Welcome back, Yuri.</p>
        </header>
        <div className={styles.grid}>
          <button className={`${styles.card} ${styles.daily}`} type="button">
            <span className={styles.copy}>
              <strong>Daily Wordle</strong>
              <span>Next puzzle 08:42:16</span>
            </span>
            <span className={styles.dailyArt} aria-hidden="true">
              {dailyColors.map((color, index) => (
                <i className={styles[color]} key={index} />
              ))}
            </span>
          </button>
          <button className={`${styles.card} ${styles.free}`} type="button">
            <span className={styles.copy}>
              <strong>Free Play</strong>
              <span>Practice freely.</span>
            </span>
            <span className={styles.freeArt} aria-hidden="true">
              <i>W</i>
              <i>R</i>
              <i>D</i>
            </span>
          </button>
          <button className={`${styles.card} ${styles.battle}`} type="button">
            <span className={styles.copy}>
              <strong>Friendly Battle</strong>
              <span>Play with friends.</span>
            </span>
            <Swords className={styles.largeIcon} aria-hidden="true" />
          </button>
          <button className={`${styles.card} ${styles.leaderboard}`} type="button">
            <span className={styles.copy}>
              <strong>Leaderboards</strong>
              <span>See the rankings.</span>
            </span>
            <Trophy className={styles.largeIcon} aria-hidden="true" />
          </button>
        </div>
      </section>
    </AppShell>
  );
}
