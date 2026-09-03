import { ArrowLeft, ChevronDown, Flame, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DailyHistoryStrip } from "@/components/profile/daily-history-strip";
import { BattleHistoryList } from "@/components/profile/battle-history-list";
import { FriendProfileActions } from "@/components/profile/friend-profile-actions";
import styles from "@/components/profile/profile.module.css";
import { AppShell } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { requireCompleteAccount } from "@/lib/auth";
import { parsePlayerBattleHistory, type PlayerBattleHistory } from "@/lib/battle-history";
import {
  parsePlayerDailyHistory,
  parsePlayerProfile,
  type PlayerDailyHistory,
} from "@/lib/player-profile";
import { streakHue } from "@/lib/profile";
import { attachBattleHistoryAvatarUrls, attachSignedAvatarUrls } from "@/lib/social.server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

function relativeActivity(lastOnlineAt: string | null, online: boolean) {
  if (!lastOnlineAt) return "Offline";
  if (online) return "Online now";
  const minutes = Math.max(1, Math.floor((Date.now() - Date.parse(lastOnlineAt)) / 60_000));
  if (minutes < 60) return `Last online ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last online ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `Last online ${days} ${days === 1 ? "day" : "days"} ago`;
}

export default async function FriendProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{
    from?: string;
    scope?: string;
    tab?: string;
    sort?: string;
    fq?: string;
    pq?: string;
  }>;
}) {
  const { username: routeUsername } = await params;
  const account = await requireCompleteAccount(`/profile/${encodeURIComponent(routeUsername)}`);
  const origin = await searchParams;
  const fromLeaderboards = origin.from === "leaderboards";
  const fromFriends = origin.from === "friends";
  const leaderboardScope = origin.scope === "friends" ? "friends" : "global";
  const friendsTab = ["friends", "requests", "find"].includes(origin.tab ?? "")
    ? origin.tab!
    : "friends";
  const friendSort = [
    "activity_desc",
    "activity_asc",
    "added_first",
    "added_last",
    "alphabetical",
  ].includes(origin.sort ?? "")
    ? origin.sort!
    : "activity_desc";
  const friendsReturnParams = new URLSearchParams({ tab: friendsTab });
  if (friendSort !== "activity_desc") friendsReturnParams.set("sort", friendSort);
  if (origin.fq) friendsReturnParams.set("fq", origin.fq.slice(0, 40));
  if (origin.pq) friendsReturnParams.set("pq", origin.pq.slice(0, 40));
  if (!/^[A-Za-z0-9]{1,20}$/.test(routeUsername)) notFound();
  if (routeUsername.toLowerCase() === account.profile.username!.toLowerCase()) redirect("/profile");

  const supabase = await getSupabaseServerClient();
  const [
    { data: profileData, error: profileError },
    { data: historyData },
    { data: battleHistoryData },
  ] = await Promise.all([
    supabase.rpc("get_player_profile", { target_username: routeUsername }),
    supabase.rpc("get_player_daily_history", { target_username: routeUsername }),
    supabase.rpc("get_player_battle_history", { target_username: routeUsername }),
  ]);
  if (profileError || !profileData) notFound();

  let profile = parsePlayerProfile(profileData);
  [profile] = await attachSignedAvatarUrls([profile]);
  let history: PlayerDailyHistory = { visible: false, cards: [] };
  let battleHistory: PlayerBattleHistory = { visible: false, matches: [] };
  try {
    if (historyData) history = parsePlayerDailyHistory(historyData);
  } catch {
    // The identity remains available when activity history is temporarily unavailable.
  }
  try {
    if (battleHistoryData) {
      battleHistory = await attachBattleHistoryAvatarUrls(
        parsePlayerBattleHistory(battleHistoryData),
      );
    }
  } catch {
    // The profile remains available when battle history is temporarily unavailable.
  }

  const ownUsername = account.profile.username!;
  const profileDisplayName = profile.alias || profile.displayName;
  const streakColor =
    profile.currentStreak > 0 ? `hsl(${streakHue(profile.currentStreak)} 68% 47%)` : "var(--muted)";
  const experienceProgress = Math.min(100, (profile.experience / profile.experienceCap) * 100);
  const stats = profile.statistics;
  const twoPlayerTotal = stats ? stats.battles.twoPlayerWins + stats.battles.twoPlayerLosses : 0;
  const twoPlayerWinRate =
    stats && twoPlayerTotal ? Math.round((stats.battles.twoPlayerWins / twoPlayerTotal) * 100) : 0;

  return (
    <AppShell
      account={{
        displayName: account.profile.display_name || ownUsername,
        username: ownUsername,
        avatarUrl: account.avatarUrl,
        theme: account.settings.theme,
        highContrast: account.settings.high_contrast_tiles,
      }}
    >
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Profile</h1>
          {fromLeaderboards ? (
            <Link className={styles.returnButton} href={`/leaderboards?scope=${leaderboardScope}`}>
              <ArrowLeft aria-hidden="true" />
              Back to Leaderboards
            </Link>
          ) : fromFriends ? (
            <Link
              className={styles.returnButton}
              href={`/friends?${friendsReturnParams.toString()}`}
            >
              <ArrowLeft aria-hidden="true" />
              Back to Friends
            </Link>
          ) : null}
        </header>
        <section className={styles.hero}>
          <div className={styles.friendIdentity}>
            <Avatar name={profileDisplayName} imageUrl={profile.avatarUrl} size="large" />
            <div className={styles.friendIdentityCopy}>
              <div className={styles.friendNameRow}>
                <h2>{profileDisplayName}</h2>
                <span className={styles.activityStatus}>
                  <i
                    className={profile.online ? styles.activityOnline : undefined}
                    aria-hidden="true"
                  />
                  {relativeActivity(profile.lastOnlineAt, profile.online)}
                </span>
              </div>
              <span className={styles.handle}>@{profile.username}</span>
              <div className={styles.friendBioRow}>
                {profile.bio ? <p className={styles.bio}>{profile.bio}</p> : <span />}
                <FriendProfileActions profile={profile} />
              </div>
            </div>
          </div>
          <div className={styles.friendProfileFooter}>
            <div className={styles.progressCard}>
              <div className={styles.progressMeta}>
                <strong>Level {profile.level}</strong>
                <span>
                  {profile.experience}/{profile.experienceCap} EXP
                </span>
              </div>
              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-label={`${profileDisplayName}'s experience`}
                aria-valuemin={0}
                aria-valuemax={profile.experienceCap}
                aria-valuenow={profile.experience}
              >
                <span aria-hidden="true" style={{ width: `${experienceProgress}%` }} />
              </div>
            </div>
            <div className={styles.streakCard}>
              <strong className={styles.streakValue} style={{ color: streakColor }}>
                {profile.currentStreak > 0 ? <Flame aria-hidden="true" /> : null}
                {profile.currentStreak} day streak
              </strong>
            </div>
          </div>
        </section>

        <section className={styles.dailySection}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Daily Wordle</h2>
          </div>
          {profile.dailyHistoryVisible && history.visible ? (
            <DailyHistoryStrip cards={history.cards} />
          ) : (
            <div className={styles.privateBox}>
              <LockKeyhole aria-hidden="true" />
              This activity is private
            </div>
          )}
        </section>

        <div className={styles.lowerGrid}>
          <section className={`${styles.section} ${styles.statisticsSection}`}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Statistics</h2>
            </div>
            {profile.statisticsVisible && stats ? (
              <div className={styles.contentBox}>
                <div className={styles.statGroup}>
                  <strong>Daily Wordle</strong>
                  <div className={styles.statRow}>
                    <span>Wins</span>
                    <strong>{stats.wins}</strong>
                    <span />
                  </div>
                  <details>
                    <summary className={styles.statRow}>
                      <span>Losses</span>
                      <strong>{stats.missed + stats.failed}</strong>
                      <ChevronDown aria-hidden="true" />
                    </summary>
                    <div className={`${styles.statRow} ${styles.statNestedRow}`}>
                      <span>Missed</span>
                      <strong>{stats.missed}</strong>
                      <span />
                    </div>
                    <div className={`${styles.statRow} ${styles.statNestedRow}`}>
                      <span>Failed</span>
                      <strong>{stats.failed}</strong>
                      <span />
                    </div>
                  </details>
                  <div className={styles.statRow}>
                    <span>Current Streak</span>
                    <strong>{stats.currentStreak}</strong>
                    <span />
                  </div>
                  <div className={styles.statRow}>
                    <span>Highest Streak</span>
                    <strong>{stats.highestStreak}</strong>
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
                      <strong>{stats.battles.twoPlayerWins}</strong>
                      <span />
                    </div>
                    <div className={`${styles.statRow} ${styles.statNestedRow}`}>
                      <span>Losses</span>
                      <strong>{stats.battles.twoPlayerLosses}</strong>
                      <span />
                    </div>
                  </details>
                  <div className={styles.statRow}>
                    <span>3-player</span>
                    <strong>
                      {stats.battles.threePlayerWins}W · {stats.battles.threePlayerLosses}L
                    </strong>
                    <span />
                  </div>
                  <div className={styles.statRow}>
                    <span>4+ players</span>
                    <strong>
                      {stats.battles.fourPlusWins}W · {stats.battles.fourPlusLosses}L
                    </strong>
                    <span />
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.privateBox}>
                <LockKeyhole aria-hidden="true" />
                This activity is private
              </div>
            )}
          </section>
          <section className={`${styles.section} ${styles.historySection}`}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Friendly Battle History</h2>
            </div>
            {profile.battleHistoryVisible && battleHistory.visible ? (
              <BattleHistoryList history={battleHistory} />
            ) : (
              <div className={styles.privateBox}>
                <LockKeyhole aria-hidden="true" />
                This activity is private
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
