import { parseBattleSnapshot } from "@/lib/battle";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ status: null }, { status: 401 });

  const { data, error } = await supabase.rpc("advance_my_battle", {});
  if (error) return Response.json({ status: null }, { status: 503 });
  if (!data) {
    return Response.json({ status: null }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const battle = parseBattleSnapshot(data);
    const status =
      battle.phase === "voided" ? "voided" : battle.phase === "battle_complete" ? null : "active";
    return Response.json({ status }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: null }, { status: 502 });
  }
}
