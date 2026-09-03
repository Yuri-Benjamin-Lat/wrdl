"use client";

import {
  ArrowUpDown,
  Check,
  Inbox,
  Search,
  UserPlus,
  UsersRound,
  UserSearch,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  cancelFriendRequestAction,
  respondToFriendRequestAction,
  sendFriendRequestAction,
} from "@/app/friends/actions";
import type { FriendsPage, SocialPlayer } from "@/lib/social";
import { Avatar } from "@/components/ui/avatar";
import styles from "./friends.module.css";

type FriendsTab = "friends" | "requests" | "find";
type FriendSort = "activity_desc" | "activity_asc" | "added_first" | "added_last" | "alphabetical";

const sortOptions: Array<{ value: FriendSort; label: string }> = [
  { value: "activity_desc", label: "Activity Ascending" },
  { value: "activity_asc", label: "Activity Descending" },
  { value: "added_first", label: "Added First" },
  { value: "added_last", label: "Added Last" },
  { value: "alphabetical", label: "Alphabetical" },
];

function relativeActivity(player: SocialPlayer, now: number) {
  if (!player.activityVisible || !player.lastOnlineAt) return "Offline";
  if (player.online) return "Online now";
  const elapsedMinutes = Math.max(1, Math.floor((now - Date.parse(player.lastOnlineAt)) / 60_000));
  if (elapsedMinutes < 60) return `Last online ${elapsedMinutes} min ago`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `Last online ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `Last online ${days} ${days === 1 ? "day" : "days"} ago`;
}

function PersonIdentity({ player, href }: { player: SocialPlayer; href: string }) {
  return (
    <Link className={styles.identity} href={href}>
      <Avatar name={player.alias || player.displayName} imageUrl={player.avatarUrl} />
      <span>
        <strong>{player.alias || player.displayName}</strong>
        <small>@{player.username}</small>
      </span>
    </Link>
  );
}

export function FriendsScreen({
  initialFriends,
  initialRequests,
  initialTab,
  initialSort,
  initialFriendFilter,
  initialPlayerQuery,
}: {
  initialFriends: FriendsPage;
  initialRequests: SocialPlayer[];
  initialTab: FriendsTab;
  initialSort: FriendSort;
  initialFriendFilter: string;
  initialPlayerQuery: string;
}) {
  const [tab, setTab] = useState<FriendsTab>(initialTab);
  const [friends, setFriends] = useState(initialFriends);
  const [requests, setRequests] = useState(initialRequests);
  const [results, setResults] = useState<SocialPlayer[]>([]);
  const [sort, setSort] = useState<FriendSort>(initialSort);
  const [friendFilter, setFriendFilter] = useState(initialFriendFilter);
  const [playerQuery, setPlayerQuery] = useState(initialPlayerQuery);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const firstFriendLoad = useRef(true);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    const refreshPresence = async () => {
      try {
        const response = await fetch(
          `/api/friends?sort=${sort}&q=${encodeURIComponent(friendFilter)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const next = (await response.json()) as FriendsPage;
        if (active) {
          setFriends(next);
          setNow(Date.now());
        }
      } catch {
        // The regular filtered-load error state handles sustained failures.
      }
    };

    const initial = window.setTimeout(refreshPresence, 1_000);
    const interval = window.setInterval(refreshPresence, 10_000);
    const handleActivity = () => void refreshPresence();
    window.addEventListener("wrdl:activity-touched", handleActivity);
    window.addEventListener("focus", handleActivity);
    return () => {
      active = false;
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("wrdl:activity-touched", handleActivity);
      window.removeEventListener("focus", handleActivity);
    };
  }, [friendFilter, sort]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (sort !== "activity_desc") params.set("sort", sort);
    if (friendFilter) params.set("fq", friendFilter);
    if (playerQuery) params.set("pq", playerQuery);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}?${params.toString()}`,
    );
  }, [friendFilter, playerQuery, sort, tab]);

  useEffect(() => {
    if (firstFriendLoad.current) {
      firstFriendLoad.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/friends?sort=${sort}&q=${encodeURIComponent(friendFilter)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error();
        setFriends((await response.json()) as FriendsPage);
        setMessage("");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setMessage("Friends could not be refreshed.");
      } finally {
        setLoading(false);
      }
    }, 260);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [friendFilter, sort]);

  useEffect(() => {
    if (!playerQuery) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/friends/search?q=${encodeURIComponent(playerQuery)}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as SocialPlayer[] | { message?: string };
        if (!response.ok || !Array.isArray(body)) {
          throw new Error(Array.isArray(body) ? undefined : body.message);
        }
        setResults(body);
        setMessage("");
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setResults([]);
          setMessage((error as Error).message || "Player search is unavailable.");
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [playerQuery]);

  function sendOrCancel(player: SocialPlayer) {
    startTransition(async () => {
      const response =
        player.relationship === "outgoing"
          ? await cancelFriendRequestAction(player.id)
          : await sendFriendRequestAction(player.username);
      if (!response.ok) {
        setMessage(response.message ?? "Friend request could not be updated.");
        return;
      }
      const relationship =
        "relationship" in response && response.relationship === "friends"
          ? "friends"
          : player.relationship === "outgoing"
            ? "none"
            : "outgoing";
      setResults((current) =>
        current.map((item) => (item.id === player.id ? { ...item, relationship } : item)),
      );
      setMessage(relationship === "friends" ? "You are now friends." : "");
    });
  }

  function respond(player: SocialPlayer, accept: boolean) {
    if (!player.requestId) return;
    startTransition(async () => {
      const response = await respondToFriendRequestAction(player.requestId!, accept);
      if (!response.ok) {
        setMessage(response.message ?? "Friend request could not be updated.");
        return;
      }
      setRequests((current) => current.filter((item) => item.id !== player.id));
      setMessage(accept ? `${player.displayName} is now your friend.` : "");
    });
  }

  function profileHref(player: SocialPlayer) {
    const params = new URLSearchParams({ from: "friends", tab });
    if (sort !== "activity_desc") params.set("sort", sort);
    if (friendFilter) params.set("fq", friendFilter);
    if (playerQuery) params.set("pq", playerQuery);
    return `/profile/${player.username}?${params.toString()}`;
  }

  return (
    <section className={styles.page}>
      <h1>Friends</h1>

      <div className={styles.tabs} aria-label="Friends sections">
        <button
          className={tab === "friends" ? styles.activeTab : styles.tab}
          type="button"
          aria-label="Friends"
          aria-pressed={tab === "friends"}
          onClick={() => setTab("friends")}
        >
          <UsersRound aria-hidden="true" />
        </button>
        <button
          className={tab === "requests" ? styles.activeTab : styles.tab}
          type="button"
          aria-label="Requests"
          aria-pressed={tab === "requests"}
          onClick={() => setTab("requests")}
        >
          <Inbox aria-hidden="true" />
          {requests.length ? <b>{requests.length}</b> : null}
        </button>
        <button
          className={tab === "find" ? styles.activeTab : styles.tab}
          type="button"
          aria-label="Find friends"
          aria-pressed={tab === "find"}
          onClick={() => setTab("find")}
        >
          <UserSearch aria-hidden="true" />
        </button>
      </div>

      {tab === "friends" ? (
        <>
          <div className={styles.toolbar}>
            <label className={styles.searchField}>
              <Search aria-hidden="true" />
              <input
                value={friendFilter}
                onChange={(event) => setFriendFilter(event.target.value)}
                placeholder="Search friends"
                aria-label="Search existing friends"
              />
            </label>
            <details className={styles.sortMenu}>
              <summary aria-label="Sort friends">
                <ArrowUpDown aria-hidden="true" />
              </summary>
              <div>
                {sortOptions.map((option) => (
                  <button
                    className={sort === option.value ? styles.selectedSort : undefined}
                    type="button"
                    key={option.value}
                    onClick={() => setSort(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </details>
          </div>
          <div className={styles.list} aria-busy={loading}>
            {friends.items.map((player) => (
              <article className={styles.personRow} key={player.id}>
                <PersonIdentity player={player} href={profileHref(player)} />
                <span className={styles.activity}>
                  {relativeActivity(player, now)}
                  <i
                    className={player.online ? styles.online : styles.offline}
                    aria-hidden="true"
                  />
                </span>
              </article>
            ))}
            {!friends.items.length && !loading ? (
              <p className={styles.empty}>Your accepted friends will appear here.</p>
            ) : null}
          </div>
        </>
      ) : null}

      {tab === "requests" ? (
        <div className={styles.list}>
          {requests.map((player) => (
            <article className={styles.personRow} key={player.id}>
              <PersonIdentity player={player} href={profileHref(player)} />
              <span className={styles.requestActions}>
                <button
                  type="button"
                  aria-label={`Accept ${player.username}'s request`}
                  disabled={isPending}
                  onClick={() => respond(player, true)}
                >
                  <Check aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={`Decline ${player.username}'s request`}
                  disabled={isPending}
                  onClick={() => respond(player, false)}
                >
                  <X aria-hidden="true" />
                </button>
              </span>
            </article>
          ))}
          {!requests.length ? <p className={styles.empty}>No friend requests right now.</p> : null}
        </div>
      ) : null}

      {tab === "find" ? (
        <>
          <label className={styles.searchField}>
            <Search aria-hidden="true" />
            <input
              value={playerQuery}
              onChange={(event) => {
                const value = event.target.value;
                setPlayerQuery(value);
                if (!value) {
                  setResults([]);
                  setMessage("");
                }
              }}
              placeholder="Search by username"
              aria-label="Search by username"
            />
          </label>
          <div className={styles.list} aria-busy={loading}>
            {results.map((player) => (
              <article className={styles.personRow} key={player.id}>
                <PersonIdentity player={player} href={profileHref(player)} />
                {player.relationship === "friends" ? (
                  <span className={styles.relationship}>Friends</span>
                ) : player.relationship === "incoming" ? (
                  <span className={styles.relationship}>Request received</span>
                ) : (
                  <button
                    className={styles.friendAction}
                    type="button"
                    disabled={isPending}
                    onClick={() => sendOrCancel(player)}
                  >
                    {player.relationship === "outgoing" ? null : <UserPlus aria-hidden="true" />}
                    {player.relationship === "outgoing" ? "Cancel Request" : "Add Friend"}
                  </button>
                )}
              </article>
            ))}
            {playerQuery && !results.length && !loading && !message ? (
              <p className={styles.empty}>No players found.</p>
            ) : null}
          </div>
        </>
      ) : null}

      {message ? <p className={styles.message}>{message}</p> : null}
    </section>
  );
}
