import { ChevronDown, Flame, Globe2, LockKeyhole, UsersRound } from "lucide-react";
import { experienceRequiredForLevel } from "@wrdl/game-core";

import { DailyHistoryStrip } from "@/components/profile/daily-history-strip";
import { BattleHistoryList } from "@/components/profile/battle-history-list";
import { ProfileEditor } from "@/components/profile/profile-editor";
import styles from "@/components/profile/profile.module.css";
import { AppShell } from "@/components/shell/app-shell";
import { requireCompleteAccount } from "@/lib/auth";
import { parseDailyHistory, type DailyHistory } from "@/lib/daily-history";
import {
  EMPTY_BATTLE_STATISTICS,
  parsePlayerBattleHistory,
  type PlayerBattleHistory,
} from "@/lib/battle-history";
import type { WrdlAudience } from "@/lib/database.types";
import { streakHue } from "@/lib/profile";
import { parsePlayerProfile } from "@/lib/player-profile";
import { attachBattleHistoryAvatarUrls } from "@/lib/social.server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

function AudienceIcon({ audience, label }: { audience: WrdlAudience; label: string }) {
  if (audience === "none") return <LockKeyhole aria-label={`${label}: None`} />;
  if (audience === "friends") return <UsersRound aria-label={`${label}: Friends`} />;
  return <Globe2 aria-label={`${label}: Public`} />;
}

export default async function ProfilePage() {
  const account = await requireCompleteAccount("/profile");
  const supabase = await getSupabaseServerClient();
  const username = account.profile.username!;
  const [{ data: dailyHistoryData }, { data: profileData }, { data: battleHistoryData }] =
    await Promise.all([
      supabase.rpc("get_my_daily_history"),
      supabase.rpc("get_player_profile", { target_username: username }),
      supabase.rpc("get_player_battle_history", { target_username: username }),
    ]);
  let dailyHistory: DailyHistory = {
    wins: 0,
    missed: 0,
    failed: 0,
    currentStreak: account.profile.current_streak,
    highestStreak: account.profile.current_streak,
    cards: [],
  };
  try {
    dailyHistory = parseDailyHistory(dailyHistoryData);
  } catch {
    // The profile remains usable while Daily history is temporarily unavailable.
  }
  let battleStatistics = EMPTY_BATTLE_STATISTICS;
  let battleHistory: PlayerBattleHistory = { visible: true, matches: [] };
  try {
    const profile = parsePlayerProfile(profileData);
    battleStatistics = profile.statistics?.battles ?? EMPTY_BATTLE_STATISTICS;
  } catch {
    // Keep the profile usable while battle statistics are temporarily unavailable.
  }
  try {
    battleHistory = await attachBattleHistoryAvatarUrls(
      parsePlayerBattleHistory(battleHistoryData),
    );
  } catch {
    // Keep the profile usable while battle history is temporarily unavailable.
  }
  const twoPlayerTotal = battleStatistics.twoPlayerWins + battleStatistics.twoPlayerLosses;
  const twoPlayerWinRate = twoPlayerTotal
    ? Math.round((battleStatistics.twoPlayerWins / twoPlayerTotal) * 100)
    : 0;
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
  const experienceCap = experienceRequiredForLevel(account.profile.level);
  const experienceProgress = Math.min(100, (account.profile.experience / experienceCap) * 100);

  return (
    <AppShell account={shellAccount}>
      <div className={styles.page}>
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
          />
          <div className={styles.progressGrid}>
            <div className={styles.progressCard}>
              <div className={styles.progressMeta}>
                <strong>Level {account.profile.level}</strong>
                <span>
                  {account.profile.experience}/{experienceCap} EXP
                </span>
              </div>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-label={`Level ${account.profile.level} experience`}
                aria-valuemin={0}
                aria-valuemax={experienceCap}
                aria-valuenow={account.profile.experience}
              >
                <span aria-hidden="true" style={{ width: `${experienceProgress}%` }} />
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
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Daily Wordle</h2>
            <AudienceIcon
              audience={account.settings.daily_history_audience}
              label="Daily Wordle visibility"
            />
          </div>
          <DailyHistoryStrip cards={dailyHistory.cards} />
        </section>

        <div className={styles.lowerGrid}>
          <section className={`${styles.section} ${styles.statisticsSection}`}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Statistics</h2>
              <AudienceIcon
                audience={account.settings.statistics_audience}
                label="Statistics visibility"
              />
            </div>
            <div className={styles.contentBox}>
              <div className={styles.statGroup}>
                <strong>Daily Wordle</strong>
                <div className={styles.statRow}>
                  <span>Wins</span>
                  <strong>{dailyHistory.wins}</strong>
                  <span />
                </div>
                <details>
                  <summary className={styles.statRow}>
                    <span>Losses</span>
                    <strong>{dailyHistory.missed + dailyHistory.failed}</strong>
                    <ChevronDown aria-hidden="true" />
                  </summary>
                  <div className={`${styles.statRow} ${styles.statNestedRow}`}>
                    <span>Missed</span>
                    <strong>{dailyHistory.missed}</strong>
                    <span />
                  </div>
                  <div className={`${styles.statRow} ${styles.statNestedRow}`}>
                    <span>Failed</span>
                    <strong>{dailyHistory.failed}</strong>
                    <span />
                  </div>
                </details>
                <div className={styles.statRow}>
                  <span>Current Streak</span>
                  <strong>{dailyHistory.currentStreak}</strong>
                  <span />
                </div>
                <div className={styles.statRow}>
                  <span>Highest Streak</span>
                  <strong>{dailyHistory.highestStreak}</strong>
                  <span />
                </div>
              </div>
              <div className={styles.statGroup}>
                <strong>Friendly Battles</strong>
                <details>
                  <summary className={styles.statRow}>
                    <span>2-player</span>
                    <strong>{twoPlayerWinRate}%</strong>
                    <ChevronDown aria-hidden="true" />
                  </summary>
                  <div className={`${styles.statRow} ${styles.statNestedRow}`}>
                    <span>Wins</span>
                    <strong>{battleStatistics.twoPlayerWins}</strong>
                    <span />
                  </div>
                  <div className={`${styles.statRow} ${styles.statNestedRow}`}>
                    <span>Losses</span>
                    <strong>{battleStatistics.twoPlayerLosses}</strong>
                    <span />
                  </div>
                </details>
                <div className={styles.statRow}>
                  <span>3-player</span>
                  <strong>
                    {battleStatistics.threePlayerWins}W · {battleStatistics.threePlayerLosses}L
                  </strong>
                  <span />
                </div>
                <div className={styles.statRow}>
                  <span>4+ players</span>
                  <strong>
                    {battleStatistics.fourPlusWins}W · {battleStatistics.fourPlusLosses}L
                  </strong>
                  <span />
                </div>
              </div>
            </div>
          </section>
          <section className={`${styles.section} ${styles.historySection}`}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Friendly Battle History</h2>
              <AudienceIcon
                audience={account.settings.battle_history_audience}
                label="Battle history visibility"
              />
            </div>
            <BattleHistoryList history={battleHistory} />
          </section>
        </div>
      </div>
    </AppShell>
  );
}
