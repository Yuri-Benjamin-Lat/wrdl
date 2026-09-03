"use server";

import { revalidatePath } from "next/cache";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";

async function authenticatedClient() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");
  return supabase;
}

function refreshSocialPages(username?: string) {
  revalidatePath("/friends");
  revalidatePath("/leaderboards");
  if (username) revalidatePath(`/profile/${username}`);
}

export async function sendFriendRequestAction(username: string) {
  if (!/^[A-Za-z0-9]{1,20}$/.test(username)) return { ok: false, message: "Invalid username." };
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("send_friend_request", {
    target_username: username,
  });
  if (error) return { ok: false, message: "Friend request could not be sent." };
  refreshSocialPages(username);
  return { ok: true, relationship: data };
}

export async function cancelFriendRequestAction(userId: string) {
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("cancel_friend_request", { target_user: userId });
  if (error) return { ok: false, message: "Friend request could not be cancelled." };
  refreshSocialPages();
  return { ok: true };
}

export async function respondToFriendRequestAction(requestId: string, accept: boolean) {
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("respond_to_friend_request", {
    request_id: requestId,
    accept_request: accept,
  });
  if (error) return { ok: false, message: "That request is no longer available." };
  refreshSocialPages();
  return { ok: true };
}

export async function removeFriendAction(userId: string, username?: string) {
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("remove_friend", { target_user: userId });
  if (error) return { ok: false, message: "Friend could not be removed." };
  refreshSocialPages(username);
  return { ok: true };
}

export async function setFriendAliasAction(userId: string, alias: string, username?: string) {
  if (alias.trim().length > 20) return { ok: false, message: "Use 20 characters or fewer." };
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("set_friend_alias", {
    target_user: userId,
    new_alias: alias,
  });
  if (error) return { ok: false, message: "Alias could not be saved." };
  refreshSocialPages(username);
  return { ok: true };
}

export async function setBattleInviteBlockAction(userId: string, blocked: boolean) {
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("set_battle_invite_block", {
    target_user: userId,
    blocked,
  });
  if (error) return { ok: false, message: "Battle invitation setting could not be changed." };
  refreshSocialPages();
  return { ok: true };
}
