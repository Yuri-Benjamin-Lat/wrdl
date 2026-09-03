"use client";

import {
  ChevronLeft,
  ChevronRight,
  Crown,
  MoreHorizontal,
  Search,
  Swords,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  createPartyAction,
  leavePartyAction,
  recoverPartyStartAction,
  removePartyMemberAction,
  sendPartyInvitationAction,
  setPartyReadyAction,
  transferPartyHostAction,
  updatePartySettingsAction,
} from "@/app/battle/actions";
import type { PartyEnvelope, PartyInviteCandidate, PartyMember, PartySnapshot } from "@/lib/party";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import styles from "./battle-lobby.module.css";

const roundValues = [1, 3, 5] as const;
const timerValues = Array.from({ length: 19 }, (_, index) => 60 + index * 30);

function cycle(values: readonly number[], current: number, direction: -1 | 1) {
  const index = Math.max(0, values.indexOf(current));
  return values[(index + direction + values.length) % values.length]!;
}

function timerLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}:${remainder.toString().padStart(2, "0")} min` : `${minutes} min`;
}

function playerName(player: { alias: string | null; displayName: string }) {
  return player.alias || player.displayName;
}

type ManageAction = { type: "transfer" | "remove"; member: PartyMember } | null;

export function BattleLobby({
  initialParty,
  initialInviteUsername,
}: {
  initialParty: PartySnapshot | null;
  initialInviteUsername: string | null;
}) {
  const router = useRouter();
  const [party, setParty] = useState(initialParty);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [candidates, setCandidates] = useState<PartyInviteCandidate[]>([]);
  const [invitingCandidateIds, setInvitingCandidateIds] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState("");
  const [realtimeHealthy, setRealtimeHealthy] = useState(false);
  const [manageAction, setManageAction] = useState<ManageAction>(null);
  const [pending, startTransition] = useTransition();
  const creating = useRef(false);
  const leaving = useRef(false);
  const initialInviteSent = useRef(false);
  const allReadyRecovery = useRef<string | null>(null);
  const startingRecovery = useRef<string | null>(null);
  const enteringBattle = useRef(false);

  const enterBattle = useCallback((battleId: string) => {
    if (enteringBattle.current) return;
    enteringBattle.current = true;
    window.location.replace(`/battle?match=${encodeURIComponent(battleId)}`);
  }, []);

  const refreshParty = useCallback(async () => {
    if (leaving.current) return;
    try {
      const response = await fetch("/api/party", { cache: "no-store" });
      if (!response.ok) return;
      const envelope = (await response.json()) as PartyEnvelope;
      if (leaving.current) return;
      if (envelope.removed) setMessage("You were removed from the lobby.");
      setParty((current) => {
        if (!current || !envelope.party) return envelope.party;
        if (
          current.id === envelope.party.id &&
          envelope.party.stateVersion < current.stateVersion
        ) {
          return current;
        }
        return envelope.party;
      });
    } catch {
      // Realtime or the fallback poll retries automatically.
    }
  }, []);

  useEffect(() => {
    if (party || creating.current || leaving.current) return;
    creating.current = true;
    startTransition(async () => {
      const result = await createPartyAction();
      if (result.ok) setParty(result.party);
      else setMessage(result.message);
      creating.current = false;
    });
  }, [party]);

  const partyId = party?.id;

  useEffect(() => {
    if (!partyId) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`party:${partyId}`, { config: { private: true } })
      .on("broadcast", { event: "party_changed" }, () => void refreshParty())
      .subscribe((status) => setRealtimeHealthy(status === "SUBSCRIBED"));
    return () => {
      setRealtimeHealthy(false);
      void supabase.removeChannel(channel);
    };
  }, [partyId, refreshParty]);

  useEffect(() => {
    if (!partyId || realtimeHealthy) return;
    const fallback = window.setInterval(refreshParty, 10_000);
    return () => window.clearInterval(fallback);
  }, [partyId, realtimeHealthy, refreshParty]);

  useEffect(() => {
    if (party?.phase !== "match_starting" || !party.activeBattleId) return;
    enterBattle(party.activeBattleId);
  }, [enterBattle, party?.activeBattleId, party?.phase]);

  useEffect(() => {
    if (
      !party ||
      party.phase !== "lobby" ||
      party.memberCount < 2 ||
      party.readyCount !== party.memberCount ||
      !party.members.some((member) => member.relationship === "self" && member.ready)
    ) {
      return;
    }
    const recoveryKey = `${party.id}:${party.stateVersion}`;
    if (allReadyRecovery.current === recoveryKey) return;
    allReadyRecovery.current = recoveryKey;
    startTransition(async () => {
      const result = await setPartyReadyAction(true);
      if (!result.ok) {
        allReadyRecovery.current = null;
        return setMessage(result.message);
      }
      setParty(result.party);
      if (result.party.activeBattleId) enterBattle(result.party.activeBattleId);
      if (result.party.phase === "lobby" && result.party.readyCount === result.party.memberCount) {
        allReadyRecovery.current = null;
      }
    });
  }, [enterBattle, party]);

  useEffect(() => {
    if (!party || party.phase !== "match_starting") return;
    const recoveryKey = `${party.id}:${party.activeBattleId ?? "unclaimed"}`;
    if (startingRecovery.current === recoveryKey) return;
    startingRecovery.current = recoveryKey;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const result = await recoverPartyStartAction();
        if (!result.ok) {
          startingRecovery.current = null;
          return setMessage(result.message);
        }
        setParty(result.party);
        if (result.party.activeBattleId) enterBattle(result.party.activeBattleId);
        if (result.party.phase === "match_starting") {
          startingRecovery.current = null;
        }
      });
    }, 1_500);
    return () => window.clearTimeout(timer);
  }, [enterBattle, party]);

  useEffect(() => {
    if (!party?.isHost || !initialInviteUsername || initialInviteSent.current) return;
    initialInviteSent.current = true;
    startTransition(async () => {
      const result = await sendPartyInvitationAction(initialInviteUsername);
      setMessage(
        result.ok
          ? `Invitation sent to @${initialInviteUsername}.`
          : (result.message ?? "The invitation could not be sent."),
      );
    });
  }, [initialInviteUsername, party?.isHost]);

  useEffect(() => {
    if (!inviteOpen || !party?.isHost) return;
    let active = true;
    let loading = false;
    const loadCandidates = () => {
      if (loading) return;
      loading = true;
      void (async () => {
        try {
          const response = await fetch(
            `/api/party/candidates?filter=${encodeURIComponent(inviteQuery)}`,
            { cache: "no-store" },
          );
          if (!active) return;
          if (!response.ok) throw new Error("Candidate refresh failed");
          setCandidates((await response.json()) as PartyInviteCandidate[]);
        } catch {
          if (active) setMessage("Online friends could not be refreshed.");
        } finally {
          loading = false;
        }
      })();
    };
    const timer = window.setTimeout(loadCandidates, 220);
    const interval = window.setInterval(loadCandidates, 1_000);
    const handleActivity = () => loadCandidates();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") loadCandidates();
    };
    window.addEventListener("wrdl:activity-touched", handleActivity);
    window.addEventListener("focus", handleActivity);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener("wrdl:activity-touched", handleActivity);
      window.removeEventListener("focus", handleActivity);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [inviteOpen, inviteQuery, party?.isHost]);

  if (!party) {
    return (
      <section className={styles.loading} aria-live="polite">
        <Swords aria-hidden="true" />
        <h1>Preparing your battle lobby…</h1>
        {message ? <p>{message}</p> : null}
      </section>
    );
  }

  const ownMember = party.members.find((member) => member.relationship === "self");
  const controlsLocked = party.phase !== "lobby";
  const setupLocked = controlsLocked || party.readyCount > 0;

  function changeSettings(rounds: number, timer: number) {
    startTransition(async () => {
      const result = await updatePartySettingsAction(rounds, timer);
      if (result.ok) setParty(result.party);
      else setMessage(result.message);
    });
  }

  function toggleReady() {
    startTransition(async () => {
      const result = await setPartyReadyAction(!ownMember?.ready);
      if (!result.ok) return setMessage(result.message);
      setParty(result.party);
      if (result.party.activeBattleId) enterBattle(result.party.activeBattleId);
    });
  }

  function sendInvite(candidate: PartyInviteCandidate) {
    if (invitingCandidateIds.has(candidate.id)) return;
    setInvitingCandidateIds((current) => new Set(current).add(candidate.id));
    void (async () => {
      try {
        const result = await sendPartyInvitationAction(candidate.username);
        if (!result.ok) {
          setMessage(result.message ?? "The invitation could not be sent.");
        } else {
          setCandidates((current) =>
            current.map((item) =>
              item.id === candidate.id ? { ...item, inviteStatus: "invited" } : item,
            ),
          );
        }
      } catch {
        setMessage("The invitation could not be sent.");
      } finally {
        setInvitingCandidateIds((current) => {
          const next = new Set(current);
          next.delete(candidate.id);
          return next;
        });
      }
    })();
  }

  function confirmManagement() {
    if (!manageAction) return;
    startTransition(async () => {
      const result =
        manageAction.type === "transfer"
          ? await transferPartyHostAction(manageAction.member.id)
          : await removePartyMemberAction(manageAction.member.id);
      if (result.ok) setParty(result.party);
      else setMessage(result.message);
      setManageAction(null);
    });
  }

  function leave() {
    leaving.current = true;
    startTransition(async () => {
      const result = await leavePartyAction();
      if (!result.ok) {
        leaving.current = false;
        return setMessage(result.message ?? "The lobby could not be left.");
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Friendly Battle</h1>
          <p>Set up the match, invite friends, and get ready.</p>
        </div>
        <Button variant="secondary" onClick={leave} disabled={pending || controlsLocked}>
          Leave Lobby
        </Button>
      </header>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Battle setup</h2>
            <p>
              {party.isHost
                ? "Your settings update for everyone."
                : "The host controls these settings."}
            </p>
          </div>
        </div>
        <div className={styles.settingsList}>
          <div className={styles.settingRow}>
            <span>
              <strong>Rounds</strong>
              <small>Match length</small>
            </span>
            {party.isHost ? (
              <span className={styles.stepper}>
                <button
                  type="button"
                  aria-label="Decrease rounds"
                  disabled={pending || setupLocked}
                  onClick={() =>
                    changeSettings(cycle(roundValues, party.rounds, -1), party.roundTimerSeconds)
                  }
                >
                  <ChevronLeft />
                </button>
                <strong>
                  {party.rounds} {party.rounds === 1 ? "round" : "rounds"}
                </strong>
                <button
                  type="button"
                  aria-label="Increase rounds"
                  disabled={pending || setupLocked}
                  onClick={() =>
                    changeSettings(cycle(roundValues, party.rounds, 1), party.roundTimerSeconds)
                  }
                >
                  <ChevronRight />
                </button>
              </span>
            ) : (
              <strong>
                {party.rounds} {party.rounds === 1 ? "round" : "rounds"}
              </strong>
            )}
          </div>
          <div className={styles.settingRow}>
            <span>
              <strong>Round timer</strong>
              <small>Time per puzzle</small>
            </span>
            {party.isHost ? (
              <span className={styles.stepper}>
                <button
                  type="button"
                  aria-label="Decrease round timer"
                  disabled={pending || setupLocked}
                  onClick={() =>
                    changeSettings(party.rounds, cycle(timerValues, party.roundTimerSeconds, -1))
                  }
                >
                  <ChevronLeft />
                </button>
                <strong>{timerLabel(party.roundTimerSeconds)}</strong>
                <button
                  type="button"
                  aria-label="Increase round timer"
                  disabled={pending || setupLocked}
                  onClick={() =>
                    changeSettings(party.rounds, cycle(timerValues, party.roundTimerSeconds, 1))
                  }
                >
                  <ChevronRight />
                </button>
              </span>
            ) : (
              <strong>{timerLabel(party.roundTimerSeconds)}</strong>
            )}
          </div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Battle lobby</h2>
            <p>Everyone present must be Ready.</p>
          </div>
          {party.isHost ? (
            <Button
              className={styles.inviteButton}
              variant="secondary"
              icon={<UserPlus />}
              disabled={pending || setupLocked || party.memberCount >= 8}
              onClick={() => setInviteOpen(true)}
            >
              {party.memberCount >= 8 ? "Lobby Full" : "Invite"}
            </Button>
          ) : null}
        </div>
        <div className={styles.memberList}>
          {party.members.map((member) => (
            <article className={styles.memberCard} key={member.id}>
              <Avatar name={playerName(member)} imageUrl={member.avatarUrl} />
              <span className={styles.memberIdentity}>
                <strong>
                  {playerName(member)}
                  {member.isHost ? <Crown aria-label="Host" /> : null}
                </strong>
                <small>@{member.username}</small>
              </span>
              <span className={`${styles.memberStatus} ${member.ready ? styles.ready : ""}`}>
                <i aria-hidden="true" />
                {member.ready ? "Ready" : member.returnedToLobby ? "Joined" : "Waiting for player"}
              </span>
              {party.isHost && !member.isHost && !setupLocked ? (
                <details className={styles.memberOptions}>
                  <summary aria-label={`Manage ${playerName(member)}`}>
                    <MoreHorizontal />
                  </summary>
                  <div>
                    <button
                      type="button"
                      onClick={() => setManageAction({ type: "transfer", member })}
                    >
                      Transfer Host
                    </button>
                    <button
                      type="button"
                      className={styles.danger}
                      onClick={() => setManageAction({ type: "remove", member })}
                    >
                      Remove Player
                    </button>
                  </div>
                </details>
              ) : null}
            </article>
          ))}
        </div>
        <footer className={styles.lobbyFooter}>
          <strong>
            {party.memberCount < 2
              ? "Invite at least one friend to get ready"
              : `${party.readyCount}/${party.memberCount} ready`}
          </strong>
          <Button
            onClick={toggleReady}
            variant={ownMember?.ready ? "secondary" : "primary"}
            disabled={pending || controlsLocked || (!ownMember?.ready && party.memberCount < 2)}
          >
            {ownMember?.ready ? "Cancel Ready" : "Ready"}
          </Button>
        </footer>
      </section>

      {message ? (
        <p className={styles.message} role="status">
          {message}
        </p>
      ) : null}

      {inviteOpen ? (
        <div className={styles.modalLayer} onMouseDown={() => setInviteOpen(false)}>
          <section className={styles.modal} onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2>Invite friends</h2>
                <p>Only online friends appear.</p>
              </div>
              <button
                type="button"
                aria-label="Close invitations"
                onClick={() => setInviteOpen(false)}
              >
                <X />
              </button>
            </header>
            <label className={styles.searchField}>
              <Search />
              <input
                value={inviteQuery}
                onChange={(event) => setInviteQuery(event.target.value)}
                placeholder="Search online friends"
              />
            </label>
            <div className={styles.candidateList}>
              {candidates.map((candidate) => (
                <article key={candidate.id}>
                  <Avatar name={playerName(candidate)} imageUrl={candidate.avatarUrl} />
                  <span>
                    <strong>{playerName(candidate)}</strong>
                    <small>@{candidate.username}</small>
                  </span>
                  <button
                    type="button"
                    disabled={
                      invitingCandidateIds.has(candidate.id) ||
                      candidate.inviteStatus !== "available"
                    }
                    onClick={() => sendInvite(candidate)}
                  >
                    {invitingCandidateIds.has(candidate.id)
                      ? "Sending…"
                      : candidate.inviteStatus === "available"
                        ? "Invite"
                        : candidate.inviteStatus === "invited"
                          ? "Invited"
                          : candidate.inviteStatus === "in_lobby"
                            ? "In your lobby"
                            : candidate.inviteStatus === "in_battle"
                              ? "In a battle"
                              : "Already in a lobby"}
                  </button>
                </article>
              ))}
              {!candidates.length && !pending ? <p>No online friends found.</p> : null}
            </div>
          </section>
        </div>
      ) : null}

      {manageAction ? (
        <div className={styles.modalLayer} onMouseDown={() => setManageAction(null)}>
          <section className={styles.confirmModal} onMouseDown={(event) => event.stopPropagation()}>
            <h2>
              {manageAction.type === "transfer"
                ? `Make ${playerName(manageAction.member)} the host?`
                : `Remove ${playerName(manageAction.member)} from the lobby?`}
            </h2>
            <p>
              {manageAction.type === "transfer"
                ? "You will lose control of lobby settings."
                : "They can return only after receiving a new invitation."}
            </p>
            <div>
              <Button variant="secondary" onClick={() => setManageAction(null)}>
                Cancel
              </Button>
              <Button
                variant={manageAction.type === "remove" ? "danger" : "primary"}
                onClick={confirmManagement}
                disabled={pending}
              >
                {manageAction.type === "transfer" ? "Transfer Host" : "Remove"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
