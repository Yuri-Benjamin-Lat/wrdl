"use server";

import { revalidatePath } from "next/cache";

import {
  parseBattleConnectionEnvelope,
  parseBattleSnapshot,
  type BattleConnectionEnvelope,
  type BattleSnapshot,
} from "@/lib/battle";
import {
  parsePartyInvitations,
  parsePartySnapshot,
  type PartyInvitation,
  type PartySnapshot,
} from "@/lib/party";
import { attachBattleAvatarUrls, attachPartyAvatarUrls } from "@/lib/social.server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

type PartyActionResult = { ok: true; party: PartySnapshot } | { ok: false; message: string };
type BattleActionResult = { ok: true; battle: BattleSnapshot } | { ok: false; message: string };
type BattleConnectionResult =
  | { ok: true; battle: BattleSnapshot | null }
  | { ok: false; message: string; reason?: "superseded" };
type BattleOpenResult =
  { ok: true; connection: BattleConnectionEnvelope } | { ok: false; message: string };

async function authenticatedClient() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");
  return supabase;
}

async function partyResult(
  data: unknown,
  error: unknown,
  message: string,
): Promise<PartyActionResult> {
  if (error || !data) return { ok: false, message };
  try {
    return { ok: true, party: await attachPartyAvatarUrls(parsePartySnapshot(data)) };
  } catch {
    return { ok: false, message: "The lobby returned an unsafe response." };
  }
}

async function battleResult(
  data: unknown,
  error: unknown,
  message: string,
): Promise<BattleActionResult> {
  if (error || !data) return { ok: false, message };
  try {
    return { ok: true, battle: await attachBattleAvatarUrls(parseBattleSnapshot(data)) };
  } catch {
    return { ok: false, message: "The battle returned an unsafe response." };
  }
}

async function battleConnectionResult(
  data: unknown,
  error: unknown,
  message: string,
): Promise<BattleConnectionResult> {
  if (error) return { ok: false, message };
  if (!data) return { ok: true, battle: null };
  return battleResult(data, null, message);
}

export async function claimBattleConnectionAction(connectionId: string) {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("claim_my_battle_connection", {
    new_connection_id: connectionId,
  });
  return battleConnectionResult(data, error, "The battle connection could not be claimed.");
}

export async function openBattleConnectionAction(connectionId: string): Promise<BattleOpenResult> {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("open_my_battle_connection", {
    new_connection_id: connectionId,
  });
  if (error || !data) {
    return { ok: false, message: "The battle connection could not be checked." };
  }
  try {
    return { ok: true, connection: parseBattleConnectionEnvelope(data) };
  } catch {
    return { ok: false, message: "The battle connection returned an unsafe response." };
  }
}

export async function heartbeatBattleAction(connectionId: string) {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("heartbeat_my_battle", {
    active_connection_id: connectionId,
  });
  if (
    error &&
    typeof error.message === "string" &&
    error.message.includes("controlled by another connection")
  ) {
    return {
      ok: false as const,
      message: "This battle was opened elsewhere.",
      reason: "superseded" as const,
    };
  }
  return battleConnectionResult(data, error, "The battle connection was lost.");
}

export async function submitBattleGuessAction(
  commandId: string,
  connectionId: string,
  guess: string,
) {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("submit_my_battle_guess", {
    command_id: commandId,
    active_connection_id: connectionId,
    submitted_guess: guess,
  });
  const fallback =
    error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "That guess could not be submitted.";
  if (error && fallback.includes("controlled by another connection")) {
    return {
      ok: false as const,
      message: "This battle was opened elsewhere.",
      reason: "superseded" as const,
    };
  }
  return battleResult(data, error, fallback);
}

export async function disconnectBattleAction(connectionId: string) {
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("disconnect_my_battle", {
    active_connection_id: connectionId,
  });
  return error ? { ok: false, message: "The battle could not be exited." } : { ok: true };
}

export async function continueFromBattleAction(): Promise<
  | { ok: true; destination: "lobby"; party: PartySnapshot }
  | { ok: true; destination: "home" }
  | { ok: false; message: string }
> {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("continue_from_battle", {});
  revalidatePath("/battle");
  revalidatePath("/");
  if (
    !error &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    (data as Record<string, unknown>).destination === "home"
  ) {
    return { ok: true, destination: "home" };
  }
  const result = await partyResult(data, error, "The original lobby could not be restored.");
  return result.ok ? { ok: true, destination: "lobby", party: result.party } : result;
}

export async function createPartyAction(): Promise<PartyActionResult> {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("create_party", {
    requested_rounds: null,
    requested_timer_seconds: null,
  });
  revalidatePath("/battle");
  return partyResult(data, error, "The lobby could not be created.");
}

export async function updatePartySettingsAction(
  rounds: number,
  timerSeconds: number,
): Promise<PartyActionResult> {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("update_party_settings", {
    new_rounds: rounds,
    new_timer_seconds: timerSeconds,
  });
  return partyResult(data, error, "Lobby settings could not be changed.");
}

export async function setPartyReadyAction(ready: boolean): Promise<PartyActionResult> {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("set_party_ready", { new_ready: ready });
  return partyResult(data, error, "Ready state could not be changed.");
}

export async function recoverPartyStartAction(): Promise<PartyActionResult> {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("recover_my_party_start", {});
  return partyResult(data, error, "The battle transition could not be recovered.");
}

export async function transferPartyHostAction(userId: string): Promise<PartyActionResult> {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("transfer_party_host", { new_host_id: userId });
  return partyResult(data, error, "Host control could not be transferred.");
}

export async function removePartyMemberAction(userId: string): Promise<PartyActionResult> {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("remove_party_member", {
    target_user_id: userId,
  });
  return partyResult(data, error, "That player could not be removed.");
}

export async function leavePartyAction() {
  const supabase = await authenticatedClient();
  const { error } = await supabase.rpc("leave_party", {});
  if (error) return { ok: false, message: "The lobby cannot be left while the match starts." };
  revalidatePath("/battle");
  return { ok: true };
}

export async function sendPartyInvitationAction(username: string) {
  if (!/^[A-Za-z0-9]{1,20}$/.test(username)) {
    return { ok: false, message: "Invalid username." };
  }
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("send_party_invitation", {
    target_username: username,
  });
  if (error || !data) return { ok: false, message: "The invitation could not be sent." };
  return { ok: true };
}

export async function respondPartyInvitationAction(invitationId: string, accept: boolean) {
  if (!/^[0-9a-f-]{36}$/i.test(invitationId)) {
    return { ok: false, message: "Invalid invitation." };
  }
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("respond_to_party_invitation", {
    invitation_id: invitationId,
    accept_invitation: accept,
  });
  if (error || !data || typeof data !== "object") {
    return { ok: false, message: "The invitation is no longer available." };
  }
  const response = data as Record<string, unknown>;
  if (response.status === "joined" && response.party) {
    try {
      const party = await attachPartyAvatarUrls(parsePartySnapshot(response.party));
      revalidatePath("/battle");
      return { ok: true, status: "joined" as const, party };
    } catch {
      return { ok: false, message: "The lobby returned an unsafe response." };
    }
  }
  if (response.status === "declined") {
    return { ok: true, status: "declined" as const };
  }
  return { ok: true, status: "unavailable" as const };
}

export async function loadPartyInvitationsAction(): Promise<
  { ok: true; invitations: PartyInvitation[] } | { ok: false; message: string }
> {
  const supabase = await authenticatedClient();
  const { data, error } = await supabase.rpc("get_my_party_invitations", {});
  if (error || !data) return { ok: false, message: "Invitations could not be loaded." };
  try {
    return { ok: true, invitations: parsePartyInvitations(data) };
  } catch {
    return { ok: false, message: "Invitations returned an unsafe response." };
  }
}
