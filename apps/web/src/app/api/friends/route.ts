import { attachSignedAvatarUrls } from "@/lib/social.server";
import { parseFriendsPage } from "@/lib/social";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

const sortOptions = new Set([
  "activity_desc",
  "activity_asc",
  "added_first",
  "added_last",
  "alphabetical",
]);

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ message: "Authentication required." }, { status: 401 });

  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") ?? "activity_desc";
  const filter = url.searchParams.get("q") ?? "";
  const offset = Number(url.searchParams.get("offset") ?? 0);
  if (!sortOptions.has(sort) || !Number.isSafeInteger(offset) || offset < 0 || filter.length > 40) {
    return Response.json({ message: "Invalid friends query." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("get_my_friends", {
    sort_order: sort,
    filter_text: filter,
    result_offset: offset,
    result_limit: 30,
  });
  if (error) return Response.json({ message: "Friends could not be loaded." }, { status: 503 });

  try {
    const page = parseFriendsPage(data);
    page.items = await attachSignedAvatarUrls(page.items);
    return Response.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "Friends returned an unsafe response." }, { status: 502 });
  }
}
