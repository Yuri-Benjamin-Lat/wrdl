import { parseBattleSnapshot } from "@/lib/battle";
import { attachBattleAvatarUrls } from "@/lib/social.server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ message: "Authentication required." }, { status: 401 });

  const { data, error } = await supabase.rpc("advance_my_battle", {});
  if (error) return Response.json({ message: "Battle is unavailable." }, { status: 503 });
  if (!data) return Response.json(null, { headers: { "Cache-Control": "no-store" } });

  try {
    return Response.json(await attachBattleAvatarUrls(parseBattleSnapshot(data)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ message: "Battle returned an unsafe response." }, { status: 502 });
  }
}
