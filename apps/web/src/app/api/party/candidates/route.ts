import { parsePartyInviteCandidates } from "@/lib/party";
import { attachPartyCandidateAvatarUrls } from "@/lib/social.server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ message: "Authentication required." }, { status: 401 });

  const filter = new URL(request.url).searchParams.get("filter") ?? "";
  if (filter.length > 40) {
    return Response.json({ message: "Search is too long." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("get_party_invite_candidates", {
    filter_text: filter,
  });
  if (error || !data) {
    return Response.json({ message: "Online friends could not be loaded." }, { status: 503 });
  }

  try {
    const candidates = parsePartyInviteCandidates(data);
    return Response.json(await attachPartyCandidateAvatarUrls(candidates), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { message: "The friend picker returned an unsafe response." },
      { status: 502 },
    );
  }
}
