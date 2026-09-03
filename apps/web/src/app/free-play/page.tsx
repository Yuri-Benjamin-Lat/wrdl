import { FreePlayExperience } from "@/components/free-play/free-play-experience";
import { ActivityHeartbeat } from "@/components/shell/activity-heartbeat";
import { PreferencesSync } from "@/components/shell/preferences-sync";
import { requireCompleteAccount } from "@/lib/auth";

export default async function FreePlayPage() {
  const account = await requireCompleteAccount("/free-play");

  return (
    <>
      <PreferencesSync
        theme={account.settings.theme}
        highContrast={account.settings.high_contrast_tiles}
      />
      <ActivityHeartbeat />
      <FreePlayExperience
        initialIncludeRare={account.settings.free_play_rare_enabled}
        soundEnabled={account.settings.sound_enabled}
      />
    </>
  );
}
