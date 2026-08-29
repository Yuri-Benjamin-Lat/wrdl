import { ChevronDown, ChevronLeft, ChevronRight, Flame, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProfileEditor } from "@/components/profile/profile-editor";
import profileStyles from "@/components/profile/profile.module.css";
import { SettingsForm } from "@/components/settings/settings-form";
import settingsStyles from "@/components/settings/settings.module.css";
import { AppShell } from "@/components/shell/app-shell";
import type { UserSettingsRow } from "@/lib/database.types";
import { streakHue } from "@/lib/profile";

const demoSettings: UserSettingsRow = {
  user_id: "00000000-0000-4000-8000-000000000000",
  sound_enabled: true,
  theme: "system",
  high_contrast_tiles: false,
  daily_history_audience: "public",
  statistics_audience: "friends",
  battle_history_audience: "none",
  activity_visible: true,
  created_at: "2026-08-29T00:00:00.000Z",
  updated_at: "2026-08-29T00:00:00.000Z",
};

type PreviewPageProps = { searchParams: Promise<{ view?: string }> };

export default async function M2PreviewPage({ searchParams }: PreviewPageProps) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { view = "profile" } = await searchParams;
  const shellAccount = {
    displayName: "Yuri",
    username: "yuri",
    avatarUrl: null,
    theme: demoSettings.theme,
    highContrast: demoSettings.high_contrast_tiles,
  };

  return (
    <AppShell account={shellAccount}>
      <div style={{ display: "grid", alignContent: "start" }}>
        <nav
          aria-label="M2 preview screens"
          style={{ display: "flex", gap: 8, justifyContent: "center", paddingTop: 8 }}
        >
          <Link href="/dev/m2?view=profile">Profile</Link>
          <span>·</span>
          <Link href="/dev/m2?view=settings">Settings</Link>
        </nav>
        {view === "settings" ? <SettingsPreview /> : <ProfilePreview />}
      </div>
    </AppShell>
  );
}

function ProfilePreview() {
  const streak = 12;
  return (
    <main className={profileStyles.page}>
      <h1 className={profileStyles.pageTitle}>Profile</h1>
      <section className={profileStyles.hero}>
        <ProfileEditor
          userId={demoSettings.user_id}
          username="yuri"
          displayName="Yuri"
          storedDisplayName="Yuri"
          bio="Wordle fan who likes friendly battles and rare words."
          avatarPath={null}
          avatarUrl={null}
          usernameChangedAt={null}
        />
        <div className={profileStyles.progressGrid}>
          <div className={profileStyles.progressCard}>
            <span>
              <strong>Level 5</strong> · 200 EXP
            </span>
            <div className={profileStyles.progressTrack}>
              <span style={{ width: "62%" }} />
            </div>
          </div>
          <div className={profileStyles.streakCard}>
            <strong
              className={profileStyles.streakValue}
              style={{ color: `hsl(${streakHue(streak)} 68% 47%)` }}
            >
              <Flame aria-hidden="true" />
              {streak} day streak
            </strong>
          </div>
        </div>
      </section>
      <section className={profileStyles.dailySection}>
        <h2 className={profileStyles.sectionTitle}>Daily Wordle</h2>
        <div className={profileStyles.dailyStrip}>
          <button className={profileStyles.arrowButton} type="button">
            <ChevronLeft aria-hidden="true" />
          </button>
          <div className={profileStyles.emptyCard}>
            Your Daily Wordle activity will appear here.
          </div>
          <button className={profileStyles.arrowButton} type="button">
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </section>
      <div className={profileStyles.lowerGrid}>
        <section className={profileStyles.section}>
          <div className={profileStyles.sectionHead}>
            <h2 className={profileStyles.sectionTitle}>Statistics</h2>
            <UsersRound />
          </div>
          <div className={profileStyles.contentBox}>
            <div className={profileStyles.statGroup}>
              <strong>Daily Wordle</strong>
              <div className={profileStyles.statRow}>
                <span>Wins</span>
                <strong>74</strong>
                <span />
              </div>
              <details>
                <summary className={profileStyles.statRow}>
                  <span>Losses</span>
                  <strong>10</strong>
                  <ChevronDown />
                </summary>
                <div className={profileStyles.statRow}>
                  <span>Missed</span>
                  <strong>2</strong>
                  <span />
                </div>
                <div className={profileStyles.statRow}>
                  <span>Failed</span>
                  <strong>8</strong>
                  <span />
                </div>
              </details>
            </div>
            <div className={profileStyles.statGroup}>
              <strong>Friendly Battles</strong>
              <details>
                <summary className={profileStyles.statRow}>
                  <span>2-player</span>
                  <strong>63%</strong>
                  <ChevronDown />
                </summary>
                <div className={profileStyles.statRow}>
                  <span>Wins</span>
                  <strong>19</strong>
                  <span />
                </div>
                <div className={profileStyles.statRow}>
                  <span>Losses</span>
                  <strong>11</strong>
                  <span />
                </div>
              </details>
              <div className={profileStyles.statRow}>
                <span>3-player</span>
                <strong>8W · 5L</strong>
                <span />
              </div>
              <div className={profileStyles.statRow}>
                <span>4+ players</span>
                <strong>6W · 9L</strong>
                <span />
              </div>
            </div>
          </div>
        </section>
        <section className={profileStyles.section}>
          <div className={profileStyles.sectionHead}>
            <h2 className={profileStyles.sectionTitle}>Friendly Battle History</h2>
            <UsersRound />
          </div>
          <div className={profileStyles.emptyCard}>
            Your completed friendly battles will appear here.
          </div>
        </section>
      </div>
    </main>
  );
}

function SettingsPreview() {
  return (
    <main className={settingsStyles.page}>
      <h1>Settings</h1>
      <SettingsForm
        userId={demoSettings.user_id}
        settings={demoSettings}
        avatarPath={null}
        deletionConfirmed={false}
      />
    </main>
  );
}
