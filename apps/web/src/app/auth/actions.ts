"use server";

import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export async function signOutAction() {
  const supabase = await getSupabaseServerClient();
  await supabase.rpc("disconnect_my_battle_for_sign_out");
  await supabase.auth.signOut();
  redirect("/sign-in");
}
