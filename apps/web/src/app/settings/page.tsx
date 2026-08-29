import { AppShell } from "@/components/shell/app-shell";
import { SettingsForm } from "@/components/settings/settings-form";
import styles from "@/components/settings/settings.module.css";
import { requireCompleteAccount } from "@/lib/auth";

type SettingsPageProps = {
  searchParams: Promise<{ delete?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const account = await requireCompleteAccount();
  const username = account.profile.username!;
  const displayName = account.profile.display_name || username;
  const { delete: deletionState } = await searchParams;
  const shellAccount = {
    displayName,
    username,
    avatarUrl: account.avatarUrl,
    theme: account.settings.theme,
    highContrast: account.settings.high_contrast_tiles,
  };

  return (
    <AppShell account={shellAccount}>
      <main className={styles.page}>
        <h1>Settings</h1>
        <SettingsForm
          userId={account.userId}
          settings={account.settings}
          avatarPath={account.profile.avatar_path}
          deletionConfirmed={deletionState === "confirmed"}
        />
      </main>
    </AppShell>
  );
}
