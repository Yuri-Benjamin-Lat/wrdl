import { parseSocialPlayer, type SocialPlayer } from "./social";

export type PartyPhase = "lobby" | "match_starting" | "active" | "battle_complete";

export type PartyMember = SocialPlayer & {
  joinOrder: number;
  ready: boolean;
  returnedToLobby: boolean;
  isHost: boolean;
};

export type PartySnapshot = {
  id: string;
  phase: PartyPhase;
  hostId: string;
  isHost: boolean;
  rounds: 1 | 3 | 5;
  roundTimerSeconds: number;
  stateVersion: number;
  startDeadline: string | null;
  activeBattleId: string | null;
  memberCount: number;
  readyCount: number;
  members: PartyMember[];
};

export type PartyEnvelope = {
  party: PartySnapshot | null;
  removed: boolean;
  removal: { partyId: string; removedAt: string } | null;
};

export type PartyInviteCandidate = SocialPlayer & {
  inviteStatus: "available" | "invited" | "in_lobby" | "other_lobby" | "in_battle";
};

export type PartyInvitation = {
  id: string;
  partyId: string;
  createdAt: string;
  playerCount: number;
  inviter: SocialPlayer;
};

const phases = new Set<PartyPhase>(["lobby", "match_starting", "active", "battle_complete"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(record: Record<string, unknown>, key: string, minimum: number, maximum: number) {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new TypeError(`Party payload has an invalid ${key}.`);
  }
  return value as number;
}

function requiredString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string" || !value)
    throw new TypeError(`Party payload has an invalid ${key}.`);
  return value;
}

function optionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== "string") throw new TypeError(`Party payload has an invalid ${key}.`);
  return value;
}

export function parsePartySnapshot(value: unknown): PartySnapshot {
  if (!isRecord(value) || !Array.isArray(value.members)) {
    throw new TypeError("Party snapshot must be an object.");
  }
  if (typeof value.phase !== "string" || !phases.has(value.phase as PartyPhase)) {
    throw new TypeError("Party snapshot has an invalid phase.");
  }
  if (typeof value.isHost !== "boolean")
    throw new TypeError("Party snapshot has invalid host state.");
  const rounds = integer(value, "rounds", 1, 5);
  if (rounds !== 1 && rounds !== 3 && rounds !== 5)
    throw new TypeError("Party rounds are invalid.");
  const timer = integer(value, "roundTimerSeconds", 60, 600);
  if (timer % 30) throw new TypeError("Party timer is invalid.");
  const memberCount = integer(value, "memberCount", 1, 8);
  const readyCount = integer(value, "readyCount", 0, memberCount);
  if (value.members.length !== memberCount)
    throw new TypeError("Party member count is inconsistent.");

  const members = value.members.map((member): PartyMember => {
    if (
      !isRecord(member) ||
      typeof member.ready !== "boolean" ||
      typeof member.returnedToLobby !== "boolean" ||
      typeof member.isHost !== "boolean"
    ) {
      throw new TypeError("Party member is malformed.");
    }
    return {
      ...parseSocialPlayer(member),
      joinOrder: integer(member, "joinOrder", 1, 64),
      ready: member.ready,
      returnedToLobby: member.returnedToLobby,
      isHost: member.isHost,
    };
  });
  if (members.filter((member) => member.isHost).length !== 1) {
    throw new TypeError("Party snapshot must contain exactly one host.");
  }
  if (members.filter((member) => member.ready).length !== readyCount) {
    throw new TypeError("Party Ready count is inconsistent.");
  }

  const startDeadline = optionalString(value, "startDeadline");
  if ((value.phase === "match_starting") !== (startDeadline !== null)) {
    throw new TypeError("Party countdown state is inconsistent.");
  }

  return {
    id: requiredString(value, "id"),
    phase: value.phase as PartyPhase,
    hostId: requiredString(value, "hostId"),
    isHost: value.isHost,
    rounds: rounds as 1 | 3 | 5,
    roundTimerSeconds: timer,
    stateVersion: integer(value, "stateVersion", 1, Number.MAX_SAFE_INTEGER),
    startDeadline,
    activeBattleId: optionalString(value, "activeBattleId"),
    memberCount,
    readyCount,
    members,
  };
}

export function parsePartyEnvelope(value: unknown): PartyEnvelope {
  if (!isRecord(value) || typeof value.removed !== "boolean") {
    throw new TypeError("Party envelope is malformed.");
  }
  const party = value.party === null ? null : parsePartySnapshot(value.party);
  let removal: PartyEnvelope["removal"] = null;
  if (value.removal !== null && value.removal !== undefined) {
    if (!isRecord(value.removal)) throw new TypeError("Party removal notice is malformed.");
    removal = {
      partyId: requiredString(value.removal, "partyId"),
      removedAt: requiredString(value.removal, "removedAt"),
    };
  }
  if (value.removed !== (removal !== null))
    throw new TypeError("Party removal state is inconsistent.");
  return { party, removed: value.removed, removal };
}

export function parsePartyInviteCandidates(value: unknown): PartyInviteCandidate[] {
  if (!Array.isArray(value) || value.length > 50)
    throw new TypeError("Invite candidates are malformed.");
  return value.map((candidate) => {
    if (
      !isRecord(candidate) ||
      !["available", "invited", "in_lobby", "other_lobby", "in_battle"].includes(
        String(candidate.inviteStatus),
      )
    ) {
      throw new TypeError("Invite candidate is malformed.");
    }
    return {
      ...parseSocialPlayer(candidate),
      inviteStatus: candidate.inviteStatus as PartyInviteCandidate["inviteStatus"],
    };
  });
}

export function parsePartyInvitations(value: unknown): PartyInvitation[] {
  if (!Array.isArray(value) || value.length > 50)
    throw new TypeError("Party invitations are malformed.");
  return value.map((invitation) => {
    if (!isRecord(invitation)) throw new TypeError("Party invitation is malformed.");
    return {
      id: requiredString(invitation, "id"),
      partyId: requiredString(invitation, "partyId"),
      createdAt: requiredString(invitation, "createdAt"),
      playerCount: integer(invitation, "playerCount", 1, 7),
      inviter: parseSocialPlayer(invitation.inviter),
    };
  });
}
