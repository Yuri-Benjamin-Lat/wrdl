import { parseLeaderboard } from "@/lib/leaderboard";
import { attachSignedAvatarUrls } from "@/lib/social.server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ message: "Authentication required." }, { status: 401 });

  const scope = new URL(request.url).searchParams.get("scope") ?? "global";
  if (scope !== "global" && scope !== "friends") {
    return Response.json({ message: "Invalid leaderboard." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("get_streak_leaderboard", {
    leaderboard_scope: scope,
  });
  if (error) return Response.json({ message: "Leaderboard could not be loaded." }, { status: 503 });

  try {
    const payload = parseLeaderboard(data);
    const signedRows = await attachSignedAvatarUrls(payload.items);
    const [signedViewer] = await attachSignedAvatarUrls([payload.viewer]);
    return Response.json(
      { ...payload, items: signedRows, viewer: signedViewer },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return Response.json({ message: "Leaderboard returned an unsafe response." }, { status: 502 });
  }
}
