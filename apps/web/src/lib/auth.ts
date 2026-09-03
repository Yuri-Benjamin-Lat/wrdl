import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import type { ProfileRow, UserSettingsRow } from "@/lib/database.types";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export type CurrentAccount = {
  userId: string;
  profile: ProfileRow;
  settings: UserSettingsRow;
  avatarUrl: string | null;
};

export const getOptionalAccount = cache(async (): Promise<CurrentAccount | null> => {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.rpc("get_my_profile"),
    supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!profile || !settings) return null;

  let avatarUrl: string | null = null;
  if (profile.avatar_path) {
    const { data } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_path, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }

  return { userId: user.id, profile, settings, avatarUrl };
});

export async function requireSignedInAccount(returnTo?: string) {
  const account = await getOptionalAccount();
  if (!account) {
    const next = returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : null;
    redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  }
  return account;
}

export async function requireCompleteAccount(returnTo?: string) {
  const account = await requireSignedInAccount(returnTo);
  if (!account.profile.username) redirect("/username-setup");
  return account;
}

export async function redirectForAccountState() {
  const account = await getOptionalAccount();
  if (!account) return;
  redirect(account.profile.username ? "/" : "/username-setup");
}
