import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { validateUsernameFormat } from "@/lib/username";

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username") ?? "";
  const validation = validateUsernameFormat(username);
  if (!validation.valid) {
    return NextResponse.json({ available: false, message: validation.message }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { available: false, message: "Sign in again to continue." },
      { status: 401 },
    );
  }

  const { data, error } = await supabase.rpc("username_is_available", { candidate: username });
  if (error) {
    return NextResponse.json(
      { available: false, message: "Availability couldn’t be checked. Try again." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    available: data,
    message: data ? "Username available" : "Username unavailable",
  });
}
