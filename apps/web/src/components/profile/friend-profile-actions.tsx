"use client";

import { Check, MoreHorizontal, Swords, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  removeFriendAction,
  sendFriendRequestAction,
  setBattleInviteBlockAction,
  setFriendAliasAction,
} from "@/app/friends/actions";
import type { PlayerProfile } from "@/lib/player-profile";
import styles from "./profile.module.css";

export function FriendProfileActions({ profile }: { profile: PlayerProfile }) {
  const router = useRouter();
  const [relationship, setRelationship] = useState(profile.relationship);
  const [blocked, setBlocked] = useState(profile.battleInvitesBlocked);
  const [alias, setAlias] = useState(profile.alias ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const [pending, startTransition] = useTransition();
  const optionsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOptions(event: PointerEvent) {
      const options = optionsRef.current;
      if (options?.open && event.target instanceof Node && !options.contains(event.target)) {
        options.removeAttribute("open");
      }
    }
    document.addEventListener("pointerdown", closeOptions);
    return () => document.removeEventListener("pointerdown", closeOptions);
  }, []);

  function addFriend() {
    startTransition(async () => {
      const result = await sendFriendRequestAction(profile.username);
      if (!result.ok) return setMessage(result.message ?? "Friend request could not be sent.");
      setRelationship(result.relationship === "friends" ? "friends" : "outgoing");
      setMessage(result.relationship === "friends" ? "You are now friends." : "Request sent.");
    });
  }

  function saveAlias() {
    startTransition(async () => {
      const result = await setFriendAliasAction(profile.id, alias, profile.username);
      if (!result.ok) {
        setMessage(result.message ?? "Alias could not be saved.");
        return;
      }
      setMessage("");
      setToast("Alias saved");
      router.refresh();
      window.setTimeout(() => setToast(""), 1800);
    });
  }

  function toggleBlock() {
    startTransition(async () => {
      const result = await setBattleInviteBlockAction(profile.id, !blocked);
      if (!result.ok) return setMessage(result.message ?? "Setting could not be changed.");
      setBlocked(!blocked);
      setMessage("");
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeFriendAction(profile.id, profile.username);
      if (!result.ok) return setMessage(result.message ?? "Friend could not be removed.");
      setRelationship("none");
      setConfirmRemove(false);
      setMessage("Friend removed.");
    });
  }

  if (relationship !== "friends") {
    return (
      <div className={styles.friendActions}>
        {relationship === "outgoing" ? (
          <span className={styles.relationshipStatus}>Request sent</span>
        ) : relationship === "incoming" ? (
          <Link className={styles.secondaryAction} href="/friends">
            View request
          </Link>
        ) : (
          <button
            className={styles.primaryAction}
            type="button"
            onClick={addFriend}
            disabled={pending}
          >
            Add Friend
          </button>
        )}
        {message ? <small>{message}</small> : null}
      </div>
    );
  }

  return (
    <div className={styles.friendActions}>
      <Link className={styles.primaryAction} href={`/battle?invite=${profile.username}`}>
        <Swords aria-hidden="true" />
        Invite to Battle
      </Link>
      <details className={styles.profileOptions} ref={optionsRef}>
        <summary aria-label="Friend options">
          <MoreHorizontal aria-hidden="true" />
        </summary>
        <div>
          <label>
            Friend alias
            <span>
              <input
                value={alias}
                maxLength={20}
                onChange={(event) => setAlias(event.target.value)}
                placeholder="Optional alias"
              />
              <button type="button" onClick={saveAlias} disabled={pending}>
                Save
              </button>
            </span>
          </label>
          <button type="button" onClick={toggleBlock} disabled={pending}>
            {blocked ? "Unblock Battle Invites" : "Block Battle Invites"}
          </button>
          <button
            className={styles.dangerText}
            type="button"
            onClick={() => setConfirmRemove(true)}
          >
            Remove Friend
          </button>
        </div>
      </details>
      {message ? <small>{message}</small> : null}
      {toast ? (
        <div className={styles.friendActionToast} role="status">
          <Check aria-hidden="true" />
          {toast}
        </div>
      ) : null}

      {confirmRemove ? (
        <div className={styles.modalLayer} onMouseDown={() => setConfirmRemove(false)}>
          <section className={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2>Remove {profile.alias || profile.displayName}?</h2>
              <button
                type="button"
                aria-label="Cancel removal"
                onClick={() => setConfirmRemove(false)}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <p>
              This removes the friendship and both personal aliases. Privacy settings stay
              unchanged.
            </p>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setConfirmRemove(false)}>
                Cancel
              </button>
              <button
                className={styles.dangerAction}
                type="button"
                onClick={remove}
                disabled={pending}
              >
                Remove Friend
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
