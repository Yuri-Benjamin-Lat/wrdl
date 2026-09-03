import { DailyExperience } from "@/components/daily/daily-experience";
import { ActivityHeartbeat } from "@/components/shell/activity-heartbeat";
import { PreferencesSync } from "@/components/shell/preferences-sync";
import { requireCompleteAccount } from "@/lib/auth";

export default async function DailyPage() {
  const account = await requireCompleteAccount("/daily");

  return (
    <>
      <PreferencesSync
        theme={account.settings.theme}
        highContrast={account.settings.high_contrast_tiles}
      />
      <ActivityHeartbeat />
      <DailyExperience soundEnabled={account.settings.sound_enabled} />
    </>
  );
}
