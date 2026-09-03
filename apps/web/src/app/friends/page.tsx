import { FriendsScreen } from "@/components/friends/friends-screen";
import { AppShell } from "@/components/shell/app-shell";
import { requireCompleteAccount } from "@/lib/auth";
import { parseFriendsPage, parseSocialPlayers } from "@/lib/social";
import { attachSignedAvatarUrls } from "@/lib/social.server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

type FriendsTab = "friends" | "requests" | "find";
type FriendSort = "activity_desc" | "activity_asc" | "added_first" | "added_last" | "alphabetical";

const friendTabs = new Set<FriendsTab>(["friends", "requests", "find"]);
const friendSorts = new Set<FriendSort>([
  "activity_desc",
  "activity_asc",
  "added_first",
  "added_last",
  "alphabetical",
]);

function safeQuery(value: string | undefined) {
  return value?.slice(0, 40) ?? "";
}

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string; fq?: string; pq?: string }>;
}) {
  const account = await requireCompleteAccount("/friends");
  const state = await searchParams;
  const initialTab = friendTabs.has(state.tab as FriendsTab)
    ? (state.tab as FriendsTab)
    : "friends";
  const initialSort = friendSorts.has(state.sort as FriendSort)
    ? (state.sort as FriendSort)
    : "activity_desc";
  const initialFriendFilter = safeQuery(state.fq);
  const initialPlayerQuery = safeQuery(state.pq);
  const supabase = await getSupabaseServerClient();
  const [{ data: friendsData }, { data: requestsData }] = await Promise.all([
    supabase.rpc("get_my_friends", {
      sort_order: initialSort,
      filter_text: initialFriendFilter,
      result_offset: 0,
      result_limit: 30,
    }),
    supabase.rpc("get_my_incoming_friend_requests", {}),
  ]);

  const friends = friendsData
    ? parseFriendsPage(friendsData)
    : { items: [], hasMore: false, nextOffset: 0 };
  const requests = requestsData ? parseSocialPlayers(requestsData) : [];
  friends.items = await attachSignedAvatarUrls(friends.items);
  const signedRequests = await attachSignedAvatarUrls(requests);
  const username = account.profile.username!;

  return (
    <AppShell
      account={{
        displayName: account.profile.display_name || username,
        username,
        avatarUrl: account.avatarUrl,
        theme: account.settings.theme,
        highContrast: account.settings.high_contrast_tiles,
        pendingFriendRequests: signedRequests.length,
      }}
    >
      <FriendsScreen
        initialFriends={friends}
        initialRequests={signedRequests}
        initialTab={initialTab}
        initialSort={initialSort}
        initialFriendFilter={initialFriendFilter}
        initialPlayerQuery={initialPlayerQuery}
      />
    </AppShell>
  );
}
