import { attachSignedAvatarUrls } from "@/lib/social.server";
import { parseSocialPlayers } from "@/lib/social";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ message: "Authentication required." }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return Response.json([]);
  if (!/^[A-Za-z0-9]{1,20}$/.test(query)) {
    return Response.json({ message: "Search with letters and numbers only." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("search_players", {
    search_text: query,
    result_limit: 20,
  });
  if (error) return Response.json({ message: "Player search is unavailable." }, { status: 503 });

  try {
    return Response.json(await attachSignedAvatarUrls(parseSocialPlayers(data)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { message: "Player search returned an unsafe response." },
      { status: 502 },
    );
  }
}
