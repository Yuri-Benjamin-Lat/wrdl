import "server-only";

import { getSupabaseServerClient } from "./supabase/server-client";
import type { BattleSnapshot } from "./battle";
import type { PlayerBattleHistory } from "./battle-history";
import type { PartyInvitation, PartyInviteCandidate, PartySnapshot } from "./party";

export async function attachSignedAvatarUrls<
  T extends { avatarPath: string | null; avatarUrl: string | null },
>(players: T[]): Promise<T[]> {
  const supabase = await getSupabaseServerClient();
  return Promise.all(
    players.map(async (player) => {
      if (!player.avatarPath) return player;
      const { data } = await supabase.storage
        .from("avatars")
        .createSignedUrl(player.avatarPath, 3600);
      return { ...player, avatarUrl: data?.signedUrl ?? null };
    }),
  );
}

export async function attachBattleHistoryAvatarUrls(
  history: PlayerBattleHistory,
): Promise<PlayerBattleHistory> {
  const standings = history.matches.flatMap((match) => match.standings);
  const signed = await attachSignedAvatarUrls(standings);
  let index = 0;
  return {
    ...history,
    matches: history.matches.map((match) => ({
      ...match,
      standings: match.standings.map(() => signed[index++]!),
    })),
  };
}

export async function attachPartyAvatarUrls(party: PartySnapshot): Promise<PartySnapshot> {
  return { ...party, members: await attachSignedAvatarUrls(party.members) };
}

export async function attachBattleAvatarUrls(battle: BattleSnapshot): Promise<BattleSnapshot> {
  const players = await attachSignedAvatarUrls(battle.players);
  const byId = new Map(players.map((player) => [player.id, player]));
  return {
    ...battle,
    players,
    viewer: byId.get(battle.viewer.id) ?? battle.viewer,
    opponent: byId.get(battle.opponent.id) ?? battle.opponent,
  };
}

export async function attachPartyCandidateAvatarUrls(
  candidates: PartyInviteCandidate[],
): Promise<PartyInviteCandidate[]> {
  return attachSignedAvatarUrls(candidates);
}

export async function attachPartyInvitationAvatarUrls(
  invitations: PartyInvitation[],
): Promise<PartyInvitation[]> {
  const inviters = await attachSignedAvatarUrls(
    invitations.map((invitation) => invitation.inviter),
  );
  return invitations.map((invitation, index) => ({ ...invitation, inviter: inviters[index]! }));
}
