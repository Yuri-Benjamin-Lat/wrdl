import { LeaderboardsScreen } from "@/components/leaderboards/leaderboards-screen";
import { AppShell } from "@/components/shell/app-shell";
import { requireCompleteAccount } from "@/lib/auth";
import { parseLeaderboard } from "@/lib/leaderboard";
import { attachSignedAvatarUrls } from "@/lib/social.server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

async function loadLeaderboard(scope: "global" | "friends") {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_streak_leaderboard", {
    leaderboard_scope: scope,
  });
  if (error || !data) throw new Error("Leaderboard could not be loaded.");
  const payload = parseLeaderboard(data);
  payload.items = await attachSignedAvatarUrls(payload.items);
  [payload.viewer] = await attachSignedAvatarUrls([payload.viewer]);
  return payload;
}

export default async function LeaderboardsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const account = await requireCompleteAccount("/leaderboards");
  const { scope } = await searchParams;
  const initialScope = scope === "friends" ? "friends" : "global";
  const [global, friends] = await Promise.all([
    loadLeaderboard("global"),
    loadLeaderboard("friends"),
  ]);
  const username = account.profile.username!;

  return (
    <AppShell
      account={{
        displayName: account.profile.display_name || username,
        username,
        avatarUrl: account.avatarUrl,
        theme: account.settings.theme,
        highContrast: account.settings.high_contrast_tiles,
      }}
    >
      <LeaderboardsScreen
        initialGlobal={global}
        initialFriends={friends}
        initialScope={initialScope}
      />
    </AppShell>
  );
}
