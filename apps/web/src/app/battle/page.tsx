import { BattleExperience } from "@/components/battle/battle-experience";
import { BattleLobby } from "@/components/battle/battle-lobby";
import { VoidedBattleReset } from "@/components/battle/voided-battle-reset";
import { WrdlLogo } from "@/components/brand/wrdl-logo";
import { ActivityHeartbeat } from "@/components/shell/activity-heartbeat";
import { PreferencesSync } from "@/components/shell/preferences-sync";
import { requireCompleteAccount } from "@/lib/auth";
import { parseBattleSnapshot, type BattleSnapshot } from "@/lib/battle";
import { reportServerApplicationError } from "@/lib/observability.server";
import { parsePartyEnvelope, type PartySnapshot } from "@/lib/party";
import { attachBattleAvatarUrls, attachPartyAvatarUrls } from "@/lib/social.server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import styles from "./page.module.css";

export default async function BattlePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const account = await requireCompleteAccount("/battle");
  const supabase = await getSupabaseServerClient();
  const { data: battleData, error: battleError } = await supabase.rpc("get_my_battle", {});
  let battle: BattleSnapshot | null = null;
  try {
    if (battleData) battle = await attachBattleAvatarUrls(parseBattleSnapshot(battleData));
  } catch {
    reportServerApplicationError("battle_snapshot_invalid");
    // The active client retries an unavailable initial battle snapshot.
  }
  if (battleError) reportServerApplicationError("battle_snapshot_unavailable");

  if (battle?.phase === "voided") {
    return <VoidedBattleReset />;
  }

  if (battle) {
    return (
      <>
        <PreferencesSync
          theme={account.settings.theme}
          highContrast={account.settings.high_contrast_tiles}
        />
        <ActivityHeartbeat />
        <BattleExperience initialBattle={battle} />
      </>
    );
  }

  const { data } = await supabase.rpc("get_my_party", {});
  let party: PartySnapshot | null = null;
  try {
    if (data) {
      const envelope = parsePartyEnvelope(data);
      if (envelope.party) party = await attachPartyAvatarUrls(envelope.party);
    }
  } catch {
    // The client retries an unavailable initial snapshot.
  }

  const { invite } = await searchParams;
  const initialInviteUsername = invite && /^[A-Za-z0-9]{1,20}$/.test(invite) ? invite : null;
  return (
    <div className={styles.focusedShell}>
      <PreferencesSync
        theme={account.settings.theme}
        highContrast={account.settings.high_contrast_tiles}
      />
      <ActivityHeartbeat />
      <header className={styles.focusedHeader}>
        <WrdlLogo size="small" />
      </header>
      <main className={styles.focusedContent}>
        <BattleLobby initialParty={party} initialInviteUsername={initialInviteUsername} />
      </main>
    </div>
  );
}
