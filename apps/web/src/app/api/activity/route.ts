import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export async function POST() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ message: "Authentication required." }, { status: 401 });

  const { data, error } = await supabase.rpc("touch_my_activity", {});
  if (error) {
    return Response.json({ message: "Activity could not be updated." }, { status: 503 });
  }

  return Response.json({ touchedAt: data }, { headers: { "Cache-Control": "no-store" } });
}
