import { parsePartyEnvelope } from "@/lib/party";
import { attachPartyAvatarUrls } from "@/lib/social.server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ message: "Authentication required." }, { status: 401 });

  const { data, error } = await supabase.rpc("get_my_party", {});
  if (error || !data) return Response.json({ message: "Lobby is unavailable." }, { status: 503 });

  try {
    const envelope = parsePartyEnvelope(data);
    if (envelope.party) envelope.party = await attachPartyAvatarUrls(envelope.party);
    return Response.json(envelope, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "Lobby returned an unsafe response." }, { status: 502 });
  }
}
