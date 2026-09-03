import type { SocialRelationship } from "./database.types";

export type SocialPlayer = {
  id: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  level: number;
  currentStreak: number;
  relationship: SocialRelationship;
  alias: string | null;
  activityVisible: boolean;
  online: boolean;
  lastOnlineAt: string | null;
  battleInvitesBlocked: boolean;
  requestId?: string;
  requestedAt?: string;
};

export type FriendsPage = {
  items: SocialPlayer[];
  hasMore: boolean;
  nextOffset: number;
};

const relationships = new Set<SocialRelationship>([
  "self",
  "none",
  "outgoing",
  "incoming",
  "friends",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`Social player has an invalid ${key}.`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new TypeError(`Social player has an invalid ${key}.`);
  return value;
}

function nonnegativeInteger(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`Social player has an invalid ${key}.`);
  }
  return value as number;
}

export function parseSocialPlayer(value: unknown): SocialPlayer {
  if (!isRecord(value)) throw new TypeError("Social player must be an object.");

  const relationship = value.relationship;
  if (typeof relationship !== "string" || !relationships.has(relationship as SocialRelationship)) {
    throw new TypeError("Social player has an invalid relationship.");
  }
  if (
    typeof value.activityVisible !== "boolean" ||
    typeof value.online !== "boolean" ||
    typeof value.battleInvitesBlocked !== "boolean"
  ) {
    throw new TypeError("Social player has invalid activity or invitation state.");
  }

  const lastOnlineAt = optionalString(value, "lastOnlineAt");
  if (!value.activityVisible && (value.online || lastOnlineAt !== null)) {
    throw new TypeError("Hidden activity leaked presence data.");
  }

  const requestId = optionalString(value, "requestId");
  const requestedAt = optionalString(value, "requestedAt");

  return {
    id: requiredString(value, "id"),
    username: requiredString(value, "username"),
    displayName: requiredString(value, "displayName"),
    avatarPath: optionalString(value, "avatarPath"),
    avatarUrl: null,
    level: nonnegativeInteger(value, "level"),
    currentStreak: nonnegativeInteger(value, "currentStreak"),
    relationship: relationship as SocialRelationship,
    alias: optionalString(value, "alias"),
    activityVisible: value.activityVisible,
    online: value.online,
    lastOnlineAt,
    battleInvitesBlocked: value.battleInvitesBlocked,
    ...(requestId ? { requestId } : {}),
    ...(requestedAt ? { requestedAt } : {}),
  };
}

export function parseSocialPlayers(value: unknown) {
  if (!Array.isArray(value)) throw new TypeError("Social player list must be an array.");
  if (value.length > 50) throw new TypeError("Social player list exceeded its page limit.");
  return value.map(parseSocialPlayer);
}

export function parseFriendsPage(value: unknown): FriendsPage {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new TypeError("Friends page must be an object.");
  }
  if (typeof value.hasMore !== "boolean") {
    throw new TypeError("Friends page has an invalid continuation state.");
  }
  return {
    items: parseSocialPlayers(value.items),
    hasMore: value.hasMore,
    nextOffset: nonnegativeInteger(value, "nextOffset"),
  };
}
