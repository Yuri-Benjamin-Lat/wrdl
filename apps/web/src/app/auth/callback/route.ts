import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");
  const requestedNext = safeNextPath(url.searchParams.get("next"));
  const signInDestination = (error: "cancelled" | "failed") => {
    const params = new URLSearchParams({ error });
    if (requestedNext) params.set("next", requestedNext);
    return new URL(`/sign-in?${params.toString()}`, url.origin);
  };

  if (providerError || !code) {
    return NextResponse.redirect(signInDestination("cancelled"));
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(signInDestination("failed"));
  }

  if (requestedNext) {
    return NextResponse.redirect(new URL(requestedNext, url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(signInDestination("failed"));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.redirect(new URL(profile?.username ? "/" : "/username-setup", url.origin));
}
