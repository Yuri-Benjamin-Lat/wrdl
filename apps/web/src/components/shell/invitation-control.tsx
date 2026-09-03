"use client";

import { Check, Swords, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { respondPartyInvitationAction } from "@/app/battle/actions";
import { Avatar } from "@/components/ui/avatar";
import { parsePartyInvitations, type PartyInvitation } from "@/lib/party";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import styles from "./invitation-control.module.css";

export function InvitationControl() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<PartyInvitation[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [realtimeHealthy, setRealtimeHealthy] = useState(false);
  const [pending, startTransition] = useTransition();
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const response = await fetch("/api/party/invitations", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { invitations?: unknown };
      const nextInvitations = parsePartyInvitations(payload.invitations);
      setInvitations(nextInvitations);
      if (!nextInvitations.length) setOpen(false);
    } catch {
      // Realtime or the fallback poll will retry.
    } finally {
      refreshInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    const supabase = getSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      channel = supabase
        .channel(`user:${data.user.id}`, { config: { private: true } })
        .on("broadcast", { event: "invitations_changed" }, () => void refresh())
        .subscribe((status) => setRealtimeHealthy(status === "SUBSCRIBED"));
    });
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(initialLoad);
      setRealtimeHealthy(false);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [refresh]);

  useEffect(() => {
    if (realtimeHealthy) return;
    const fallback = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(fallback);
  }, [realtimeHealthy, refresh]);

  useEffect(() => {
    if (!message) return;
    const dismiss = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(dismiss);
  }, [message]);

  function respond(invitation: PartyInvitation, accept: boolean) {
    startTransition(async () => {
      const result = await respondPartyInvitationAction(invitation.id, accept);
      if (!result.ok) {
        setMessage(result.message ?? "The invitation is no longer available.");
        await refresh();
        return;
      }
      if (invitations.length === 1) setOpen(false);
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      if (result.status === "joined") {
        setOpen(false);
        router.push("/battle");
        router.refresh();
      } else if (result.status === "unavailable") {
        setMessage("That lobby is no longer available.");
      }
    });
  }

  if (!invitations.length) {
    return message ? (
      <div className={styles.area}>
        <p className={styles.toast} role="status">
          {message}
        </p>
      </div>
    ) : null;
  }

  return (
    <div className={styles.area}>
      {open ? (
        <section className={styles.panel} aria-label="Battle invitations">
          <header>
            <strong>Battle Invitations</strong>
            <span>{invitations.length}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Minimize invitations">
              <X aria-hidden="true" />
            </button>
          </header>
          <div className={styles.stack}>
            {invitations.map((invitation) => (
              <article key={invitation.id}>
                <div className={styles.person}>
                  <Avatar
                    name={invitation.inviter.alias || invitation.inviter.displayName}
                    imageUrl={invitation.inviter.avatarUrl}
                  />
                  <span>
                    <strong>
                      {invitation.inviter.alias || invitation.inviter.displayName} invited you
                    </strong>
                    <small>
                      @{invitation.inviter.username} · {invitation.playerCount} player
                      {invitation.playerCount === 1 ? "" : "s"} in lobby
                    </small>
                  </span>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => respond(invitation, true)}
                  >
                    <Check aria-hidden="true" /> Accept
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => respond(invitation, false)}
                  >
                    <X aria-hidden="true" /> Decline
                  </button>
                </div>
              </article>
            ))}
            {message ? <p role="status">{message}</p> : null}
          </div>
        </section>
      ) : (
        <button
          className={styles.bubble}
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`${invitations.length} battle invitation${invitations.length === 1 ? "" : "s"}`}
        >
          <Swords aria-hidden="true" />
          <span>{invitations.length}</span>
        </button>
      )}
    </div>
  );
}
