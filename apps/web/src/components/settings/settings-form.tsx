"use client";

import { Check, ChevronDown, LogOut, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signOutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import type { UserSettingsRow, WrdlAudience, WrdlTheme } from "@/lib/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import styles from "./settings.module.css";

type SettingsFormProps = {
  userId: string;
  settings: UserSettingsRow;
  avatarPath: string | null;
  deletionConfirmed: boolean;
};

export function SettingsForm({
  userId,
  settings: initialSettings,
  avatarPath,
  deletionConfirmed,
}: SettingsFormProps) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [toast, setToast] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(deletionConfirmed);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function saveSetting(patch: Partial<UserSettingsRow>) {
    const previous = settings;
    const next = { ...settings, ...patch };
    setSettings(next);
    setError("");

    if (patch.theme) {
      if (patch.theme === "system") document.documentElement.removeAttribute("data-theme");
      else document.documentElement.dataset.theme = patch.theme;
      localStorage.setItem("wrdl-theme", patch.theme);
    }
    if (patch.high_contrast_tiles !== undefined) {
      document.documentElement.toggleAttribute("data-high-contrast", patch.high_contrast_tiles);
      localStorage.setItem("wrdl-high-contrast", String(patch.high_contrast_tiles));
    }

    const { error: updateError } = await getSupabaseBrowserClient()
      .from("user_settings")
      .update(patch)
      .eq("user_id", userId);

    if (updateError) {
      setSettings(previous);
      setError("That setting couldn’t be saved. Please try again.");
      return;
    }

    setToast("Saved");
    window.setTimeout(() => setToast(""), 1800);
  }

  async function reauthenticateForDeletion() {
    setPending(true);
    setError("");
    const returnPath = "/settings?delete=confirmed";
    const { error: authError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnPath)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (authError) {
      setPending(false);
      setError("Google verification couldn’t start. Please try again.");
    }
  }

  async function deleteAccount() {
    setPending(true);
    setError("");
    const supabase = getSupabaseBrowserClient();

    if (avatarPath) {
      const { error: avatarError } = await supabase.storage.from("avatars").remove([avatarPath]);
      if (avatarError) {
        setPending(false);
        setError("Your profile picture couldn’t be removed. Please try again before deleting.");
        return;
      }
    }

    const { error: deletionError } = await supabase.rpc("delete_my_account", {});
    if (deletionError) {
      setPending(false);
      setError(
        /recent google/i.test(deletionError.message)
          ? "Verify with Google again before deleting your account."
          : "Your account couldn’t be deleted. Please try again.",
      );
      return;
    }

    await supabase.auth.signOut({ scope: "local" });
    router.replace("/sign-in?deleted=1");
    router.refresh();
  }

  return (
    <div className={styles.settingsStack}>
      <section className={styles.section}>
        <h2>Sounds</h2>
        <div className={styles.settingList}>
          <label className={styles.settingRow}>
            <span>
              <strong>Sound effects</strong>
            </span>
            <input
              className={styles.switchInput}
              type="checkbox"
              checked={settings.sound_enabled}
              onChange={(event) => saveSetting({ sound_enabled: event.target.checked })}
            />
            <span className={styles.switch} aria-hidden="true">
              <span />
            </span>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Appearance</h2>
        <div className={styles.settingList}>
          <label className={styles.settingRow}>
            <strong>Theme</strong>
            <span className={styles.selectWrap}>
              <select
                aria-label="Theme"
                value={settings.theme}
                onChange={(event) => saveSetting({ theme: event.target.value as WrdlTheme })}
              >
                <option value="system">Follow device</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <ChevronDown aria-hidden="true" />
            </span>
          </label>
          <label className={styles.settingRow}>
            <span>
              <strong>High-contrast tiles</strong>
              <small>Color-blind mode</small>
            </span>
            <input
              className={styles.switchInput}
              type="checkbox"
              checked={settings.high_contrast_tiles}
              onChange={(event) => saveSetting({ high_contrast_tiles: event.target.checked })}
            />
            <span className={styles.switch} aria-hidden="true">
              <span />
            </span>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Privacy</h2>
        <div className={styles.settingList}>
          <AudienceRow
            label="Daily Wordle History"
            value={settings.daily_history_audience}
            onChange={(value) => saveSetting({ daily_history_audience: value })}
          />
          <AudienceRow
            label="Statistics"
            value={settings.statistics_audience}
            onChange={(value) => saveSetting({ statistics_audience: value })}
          />
          <AudienceRow
            label="Friendly Battle History"
            value={settings.battle_history_audience}
            onChange={(value) => saveSetting({ battle_history_audience: value })}
          />
          <label className={styles.settingRow}>
            <strong>Online activity</strong>
            <span className={styles.selectWrap}>
              <select
                aria-label="Online activity"
                value={settings.activity_visible ? "public" : "hidden"}
                onChange={(event) =>
                  saveSetting({ activity_visible: event.target.value === "public" })
                }
              >
                <option value="public">Public</option>
                <option value="hidden">Hidden</option>
              </select>
              <ChevronDown aria-hidden="true" />
            </span>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Account</h2>
        <div className={styles.accountActions}>
          <form action={signOutAction}>
            <Button type="submit" variant="secondary" icon={<LogOut aria-hidden="true" />}>
              Sign Out
            </Button>
          </form>
          <Button
            type="button"
            variant="danger"
            icon={<Trash2 aria-hidden="true" />}
            onClick={() => setDeleteOpen(true)}
          >
            Delete Account
          </Button>
        </div>
      </section>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {toast ? (
        <div className={styles.toast} role="status">
          <Check aria-hidden="true" />
          {toast}
        </div>
      ) : null}

      {deleteOpen ? (
        <div
          className={styles.modalLayer}
          role="presentation"
          onMouseDown={() => setDeleteOpen(false)}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <h2 id="delete-title">Delete your WRDL account?</h2>
              <button type="button" aria-label="Close" onClick={() => setDeleteOpen(false)}>
                <X aria-hidden="true" />
              </button>
            </header>
            <p>
              This permanently removes your profile, settings, friends, game details, and avatar.
              Your current username stays reserved for 30 days.
            </p>
            {deletionConfirmed ? (
              <Button fullWidth variant="danger" disabled={pending} onClick={deleteAccount}>
                {pending ? "Deleting…" : "Permanently delete account"}
              </Button>
            ) : (
              <Button fullWidth disabled={pending} onClick={reauthenticateForDeletion}>
                {pending ? "Opening Google…" : "Verify with Google"}
              </Button>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function AudienceRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: WrdlAudience;
  onChange: (value: WrdlAudience) => void;
}) {
  return (
    <label className={styles.settingRow}>
      <strong>{label}</strong>
      <span className={styles.selectWrap}>
        <select
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value as WrdlAudience)}
        >
          <option value="public">Public</option>
          <option value="friends">Friends</option>
          <option value="none">None</option>
        </select>
        <ChevronDown aria-hidden="true" />
      </span>
    </label>
  );
}
