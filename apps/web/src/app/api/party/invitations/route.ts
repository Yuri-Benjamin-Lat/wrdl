import { NextResponse } from "next/server";

import { parsePartyInvitations } from "@/lib/party";
import { attachPartyInvitationAvatarUrls } from "@/lib/social.server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ invitations: [] }, { status: 401 });

  const { data, error } = await supabase.rpc("get_my_party_invitations", {});
  if (error || !data) {
    return NextResponse.json({ invitations: [] }, { status: 503 });
  }
  try {
    const invitations = await attachPartyInvitationAvatarUrls(parsePartyInvitations(data));
    return NextResponse.json(
      { invitations },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json({ invitations: [] }, { status: 502 });
  }
}
