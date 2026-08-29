import { ChevronDown, ChevronLeft, ChevronRight, Flame, UsersRound } from "lucide-react";

import { ProfileEditor } from "@/components/profile/profile-editor";
import styles from "@/components/profile/profile.module.css";
import { AppShell } from "@/components/shell/app-shell";
import { requireCompleteAccount } from "@/lib/auth";
import { streakHue } from "@/lib/profile";

export default async function ProfilePage() {
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
  const streak = account.profile.current_streak;
  const streakColor = streak > 0 ? `hsl(${streakHue(streak)} 68% 47%)` : "var(--muted)";

  return (
    <AppShell account={shellAccount}>
      <main className={styles.page}>
        <h1 className={styles.pageTitle}>Profile</h1>
        <section className={styles.hero}>
          <ProfileEditor
            userId={account.userId}
            username={username}
            displayName={displayName}
            storedDisplayName={account.profile.display_name}
            bio={account.profile.bio ?? ""}
            avatarPath={account.profile.avatar_path}
            avatarUrl={account.avatarUrl}
            usernameChangedAt={account.profile.username_changed_at}
          />
          <div className={styles.progressGrid}>
            <div className={styles.progressCard}>
              <span>
                <strong>Level {account.profile.level}</strong> · {account.profile.experience} EXP
              </span>
              <div className={styles.progressTrack} aria-hidden="true">
                <span />
              </div>
            </div>
            <div className={styles.streakCard}>
              <strong className={styles.streakValue} style={{ color: streakColor }}>
                {streak > 0 ? <Flame aria-hidden="true" /> : null}
                {streak} day streak
              </strong>
            </div>
          </div>
        </section>

        <section className={styles.dailySection}>
          <h2 className={styles.sectionTitle}>Daily Wordle</h2>
          <div className={styles.dailyStrip}>
            <button
              className={styles.arrowButton}
              type="button"
              disabled
              aria-label="Previous activity"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <div className={styles.emptyCard}>Your Daily Wordle activity will appear here.</div>
            <button
              className={styles.arrowButton}
              type="button"
              disabled
              aria-label="Next activity"
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </section>

        <div className={styles.lowerGrid}>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Statistics</h2>
              <UsersRound
                aria-label={`Statistics visibility: ${account.settings.statistics_audience}`}
              />
            </div>
            <div className={styles.contentBox}>
              <div className={styles.statGroup}>
                <strong>Daily Wordle</strong>
                <div className={styles.statRow}>
                  <span>Wins</span>
                  <strong>0</strong>
                  <span />
                </div>
                <details>
                  <summary className={styles.statRow}>
                    <span>Losses</span>
                    <strong>0</strong>
                    <ChevronDown aria-hidden="true" />
                  </summary>
                  <div className={styles.statRow}>
                    <span>Missed</span>
                    <strong>0</strong>
                    <span />
                  </div>
                  <div className={styles.statRow}>
                    <span>Failed</span>
                    <strong>0</strong>
                    <span />
                  </div>
                </details>
              </div>
              <div className={styles.statGroup}>
                <strong>Friendly Battles</strong>
                <details>
                  <summary className={styles.statRow}>
                    <span>2-player</span>
                    <strong>0%</strong>
                    <ChevronDown aria-hidden="true" />
                  </summary>
                  <div className={styles.statRow}>
                    <span>Wins</span>
                    <strong>0</strong>
                    <span />
                  </div>
                  <div className={styles.statRow}>
                    <span>Losses</span>
                    <strong>0</strong>
                    <span />
                  </div>
                </details>
                <div className={styles.statRow}>
                  <span>3-player</span>
                  <strong>0W · 0L</strong>
                  <span />
                </div>
                <div className={styles.statRow}>
                  <span>4+ players</span>
                  <strong>0W · 0L</strong>
                  <span />
                </div>
              </div>
            </div>
          </section>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Friendly Battle History</h2>
              <UsersRound
                aria-label={`Battle history visibility: ${account.settings.battle_history_audience}`}
              />
            </div>
            <div className={styles.emptyCard}>
              Your completed friendly battles will appear here.
            </div>
          </section>
        </div>
      </main>
    </AppShell>
  );
}
