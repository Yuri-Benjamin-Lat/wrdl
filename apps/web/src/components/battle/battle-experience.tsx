"use client";

import { LogOut, MonitorX, Swords, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  claimBattleConnectionAction,
  continueFromBattleAction,
  disconnectBattleAction,
  heartbeatBattleAction,
  openBattleConnectionAction,
  submitBattleGuessAction,
} from "@/app/battle/actions";
import { WrdlLogo } from "@/components/brand/wrdl-logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GameBoard, type BoardTile } from "@/components/ui/game-board";
import { Keyboard } from "@/components/ui/keyboard";
import {
  canReuseBattleConnectionId,
  formatBattleClock,
  formatCentiseconds,
  type BattleGuess,
  type BattlePlayer,
  type BattleSnapshot,
} from "@/lib/battle";
import { dailyPatternEvaluation } from "@/lib/daily";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import styles from "./battle-experience.module.css";

type BattleConnectionState = "checking" | "active" | "elsewhere" | "superseded" | "error";

function storedConnectionId(battleId: string) {
  const key = `wrdl-battle-connection:${battleId}`;
  try {
    const existing = window.sessionStorage.getItem(key);
    const navigation = window.performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (canReuseBattleConnectionId(existing, navigation?.type ?? null)) return existing!;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function playerName(player: BattlePlayer) {
  return player.alias || player.displayName;
}

function guessTiles(guesses: BattleGuess[]): BoardTile[] {
  return guesses.flatMap((guess) =>
    dailyPatternEvaluation(guess.pattern).map((state, index) => ({
      letter: guess.guess?.[index] ?? "",
      state,
    })),
  );
}

function ownTiles(player: BattlePlayer, input: string, acceptingInput: boolean): BoardTile[] {
  const tiles = guessTiles(player.guesses);
  if (acceptingInput) {
    for (let index = 0; index < 5; index += 1) {
      const letter = input[index];
      tiles.push({
        letter,
        state: letter ? "filled" : "empty",
        active: index === input.length && input.length < 5,
      });
    }
  }
  return tiles;
}

function keyboardEvaluation(guesses: BattleGuess[]) {
  const priority = { absent: 1, present: 2, correct: 3 } as const;
  const result: Record<string, "absent" | "present" | "correct"> = {};
  for (const guess of guesses) {
    if (!guess.guess) continue;
    const evaluation = dailyPatternEvaluation(guess.pattern);
    guess.guess
      .toLowerCase()
      .split("")
      .forEach((letter, index) => {
        const state = evaluation[index]!;
        if (!result[letter] || priority[state] > priority[result[letter]]) result[letter] = state;
      });
  }
  return result;
}

function secondsUntil(deadline: string | null, clock: number, serverOffset: number) {
  if (!deadline) return 0;
  return Math.max(0, (Date.parse(deadline) - (clock + serverOffset)) / 1000);
}

function roundTimerLabel(totalSeconds: number) {
  if (totalSeconds % 60 === 0) return `${totalSeconds / 60} min`;
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")} min`;
}

function placementLabel(rank: number) {
  const suffix =
    rank % 100 >= 11 && rank % 100 <= 13
      ? "th"
      : rank % 10 === 1
        ? "st"
        : rank % 10 === 2
          ? "nd"
          : rank % 10 === 3
            ? "rd"
            : "th";
  return `${rank}${suffix}`;
}

function RoundStandings({ battle, seconds }: { battle: BattleSnapshot; seconds: number }) {
  const players = [...battle.players].sort(
    (left, right) => left.rank - right.rank || left.joinOrder - right.joinOrder,
  );
  return (
    <section className={styles.standingsScreen}>
      <header className={styles.resultHeader}>
        <div>
          <h1>Round standings</h1>
          <p>Scores updated</p>
        </div>
        <div className={styles.roundTransition}>
          <strong>
            {battle.nextSuddenDeath
              ? "Battle Tied · Sudden Death"
              : battle.isSuddenDeath
                ? `Sudden Death · Round ${battle.suddenDeathRound}`
                : `Round Complete · ${Math.min(battle.currentRound, battle.rounds)}/${battle.rounds}`}
          </strong>
          <span>
            {battle.nextSuddenDeath ? "Sudden Death begins" : "Next round"} in{" "}
            {formatBattleClock(seconds)}
          </span>
        </div>
      </header>
      <div className={styles.standingsViewport}>
        {players.map((player) => (
          <article
            className={`${styles.standingCard} ${player.id === battle.viewer.id ? styles.ownStanding : ""}`}
            key={player.id}
          >
            <strong>#{player.rank}</strong>
            <Avatar name={playerName(player)} imageUrl={player.avatarUrl} />
            <span>
              <strong>
                {playerName(player)} {player.id === battle.viewer.id ? "· You" : ""}
              </strong>
              <small>
                {player.connected ? "Round complete" : "Disconnected"}
                {player.roundPoints ? ` · +${player.roundPoints}` : ""}
              </small>
            </span>
            <b>{player.points} pts</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function BattleComplete({
  battle,
  onContinue,
  pending,
}: {
  battle: BattleSnapshot;
  onContinue: () => void;
  pending: boolean;
}) {
  const players = [...battle.players].sort(
    (left, right) => left.rank - right.rank || left.joinOrder - right.joinOrder,
  );
  const won = battle.viewer.rank === 1;
  return (
    <section className={styles.completeScreen}>
      <header className={styles.resultHeader}>
        <div>
          <h1>Battle Complete</h1>
          <p>
            You finished in {placementLabel(battle.viewer.rank)} place
            {won && players.filter((player) => player.rank === 1).length > 1 ? " · Tied" : ""}
          </p>
        </div>
        <div className={styles.completeMeta}>
          <strong>{battle.playerCount} players</strong>
          <span>
            {battle.rounds} {battle.rounds === 1 ? "round" : "rounds"} ·{" "}
            {roundTimerLabel(battle.roundTimerSeconds)}
          </span>
        </div>
      </header>
      <div className={styles.finalStandings}>
        {players.map((player) => (
          <article
            className={`${styles.finalCard} ${player.id === battle.viewer.id ? styles.ownStanding : ""} ${player.rank === 1 ? styles.winnerCard : ""}`}
            key={player.id}
          >
            <strong>#{player.rank}</strong>
            <Avatar name={playerName(player)} imageUrl={player.avatarUrl} />
            <span>
              <strong>
                {playerName(player)} {player.id === battle.viewer.id ? "· You" : ""}
              </strong>
              {player.rank === 1 ? (
                <small>
                  {players.filter((entry) => entry.rank === 1).length > 1
                    ? "Tied winner"
                    : "Winner"}
                </small>
              ) : null}
            </span>
            <b>{player.points} pts</b>
          </article>
        ))}
      </div>
      <Button className={styles.continueButton} onClick={onContinue} disabled={pending}>
        Continue to Lobby
      </Button>
    </section>
  );
}

export function BattleExperience({ initialBattle }: { initialBattle: BattleSnapshot }) {
  const router = useRouter();
  const [battle, setBattle] = useState(initialBattle);
  const [input, setInput] = useState("");
  const [message, setMessage] = useState("");
  const [exitOpen, setExitOpen] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [serverOffset, setServerOffset] = useState(
    () => Date.parse(initialBattle.serverTime) - Date.now(),
  );
  const [reconnecting, setReconnecting] = useState(false);
  const [connectionState, setConnectionState] = useState<BattleConnectionState>(() =>
    initialBattle.phase === "battle_complete" ? "active" : "checking",
  );
  const [realtimeHealthy, setRealtimeHealthy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const lastRound = useRef(initialBattle.currentRound);

  const applyBattle = useCallback((next: BattleSnapshot) => {
    setServerOffset(Date.parse(next.serverTime) - Date.now());
    setBattle((current) => (next.stateVersion >= current.stateVersion ? next : current));
    if (lastRound.current !== next.currentRound) {
      lastRound.current = next.currentRound;
      setInput("");
      setMessage("");
    }
    setReconnecting(false);
  }, []);

  const refreshBattle = useCallback(async () => {
    try {
      const response = await fetch("/api/battle", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/sign-in?next=%2Fbattle");
        return;
      }
      if (!response.ok) throw new Error("Battle refresh failed");
      const next = (await response.json()) as BattleSnapshot | null;
      if (!next || (next.phase === "voided" && next.players.every((player) => player.continued))) {
        router.refresh();
      } else applyBattle(next);
    } catch {
      setReconnecting(true);
    }
  }, [applyBattle, router]);

  useEffect(() => {
    if (initialBattle.phase === "battle_complete") return;
    const initialize = window.setTimeout(
      () => setConnectionId(storedConnectionId(initialBattle.id)),
      0,
    );
    return () => window.clearTimeout(initialize);
  }, [initialBattle.id, initialBattle.phase]);

  useEffect(() => {
    if (!connectionId || initialBattle.phase === "battle_complete") return;
    let active = true;
    void (async () => {
      try {
        const result = await openBattleConnectionAction(connectionId);
        if (!active) return;
        if (!result.ok) {
          setMessage(result.message);
          setReconnecting(true);
          setConnectionState("error");
          return;
        }
        if (result.connection.battle) applyBattle(result.connection.battle);
        if (result.connection.status === "controlling") setConnectionState("active");
        else if (result.connection.status === "active_elsewhere") setConnectionState("elsewhere");
        else if (result.connection.status === "terminal") setConnectionState("active");
        else router.refresh();
      } catch {
        if (!active) return;
        setMessage("The battle connection could not be checked.");
        setReconnecting(true);
        setConnectionState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [applyBattle, connectionAttempt, connectionId, initialBattle.phase, router]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`battle:${battle.id}`, { config: { private: true } })
      .on("broadcast", { event: "battle_changed" }, () => void refreshBattle())
      .subscribe((status) => setRealtimeHealthy(status === "SUBSCRIBED"));
    return () => {
      setRealtimeHealthy(false);
      void supabase.removeChannel(channel);
    };
  }, [battle.id, refreshBattle]);

  useEffect(() => {
    if (realtimeHealthy || connectionState !== "active") return;
    const fallback = window.setInterval(refreshBattle, 2000);
    return () => window.clearInterval(fallback);
  }, [connectionState, realtimeHealthy, refreshBattle]);

  useEffect(() => {
    if (
      !connectionId ||
      connectionState !== "active" ||
      ["battle_complete", "voided"].includes(battle.phase)
    ) {
      return;
    }
    const heartbeat = window.setInterval(() => {
      startTransition(async () => {
        try {
          const result = await heartbeatBattleAction(connectionId);
          if (result.ok && result.battle) applyBattle(result.battle);
          else if (result.ok) router.refresh();
          else if (result.reason === "superseded") setConnectionState("superseded");
          else setReconnecting(true);
        } catch {
          void refreshBattle();
        }
      });
    }, 2000);
    return () => window.clearInterval(heartbeat);
  }, [applyBattle, battle.phase, connectionId, connectionState, refreshBattle, router]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  const acceptingInput =
    connectionState === "active" &&
    battle.phase === "round_active" &&
    battle.viewer.roundStatus === "active" &&
    battle.viewer.connected;
  const tiles = useMemo(
    () => ownTiles(battle.viewer, input, acceptingInput),
    [acceptingInput, battle.viewer, input],
  );
  const opponents = useMemo(
    () => battle.players.filter((player) => player.id !== battle.viewer.id),
    [battle.players, battle.viewer.id],
  );
  const letterStates = useMemo(
    () => keyboardEvaluation(battle.viewer.guesses),
    [battle.viewer.guesses],
  );
  const roundSeconds = secondsUntil(battle.roundDeadline, clock, serverOffset);
  const phaseSeconds = secondsUntil(battle.phaseDeadline, clock, serverOffset);

  const handleKey = useCallback(
    (key: string) => {
      if (!acceptingInput || submitting) return;
      if (key === "Backspace") return setInput((current) => current.slice(0, -1));
      if (key === "Enter") {
        if (input.length !== 5) {
          setMessage("Enter a five-letter word.");
          return;
        }
        const guess = input;
        const commandId = crypto.randomUUID();
        const activeConnectionId = connectionId;
        if (!activeConnectionId) return;
        setSubmitting(true);
        void (async () => {
          try {
            const result = await submitBattleGuessAction(commandId, activeConnectionId, guess);
            if (result.ok) {
              setInput("");
              setMessage("");
              applyBattle(result.battle);
            } else if ("reason" in result && result.reason === "superseded") {
              setConnectionState("superseded");
            } else setMessage(result.message);
          } catch {
            setMessage("That guess could not be submitted. Please try again.");
            void refreshBattle();
          } finally {
            setSubmitting(false);
          }
        })();
        return;
      }
      if (/^[a-z]$/i.test(key) && input.length < 5) {
        setInput((current) => `${current}${key.toUpperCase()}`);
      }
    },
    [acceptingInput, applyBattle, connectionId, input, refreshBattle, submitting],
  );

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Enter" || event.key === "Backspace" || /^[a-z]$/i.test(event.key)) {
        event.preventDefault();
        handleKey(event.key);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [handleKey]);

  function exitBattle() {
    if (!connectionId) return;
    startTransition(async () => {
      await disconnectBattleAction(connectionId);
      router.push("/");
      router.refresh();
    });
  }

  function continueHere() {
    if (!connectionId) return;
    startTransition(async () => {
      try {
        const result = await claimBattleConnectionAction(connectionId);
        if (result.ok && result.battle) {
          applyBattle(result.battle);
          setConnectionState("active");
          setMessage("");
        } else if (result.ok) router.refresh();
        else setMessage(result.message);
      } catch {
        setMessage("Control could not be transferred. Please try again.");
      }
    });
  }

  if (connectionState !== "active") {
    const activeElsewhere = connectionState === "elsewhere";
    const failed = connectionState === "error";
    return (
      <main className={styles.page}>
        <section className={styles.screen}>
          <BattleHeader />
          <section className={styles.connectionGate} aria-live="polite">
            <span className={styles.connectionGateMark} aria-hidden="true">
              {connectionState === "checking" ? <Swords /> : <MonitorX />}
            </span>
            <h1>
              {connectionState === "checking"
                ? "Checking battle connection"
                : failed
                  ? "Unable to connect to this battle"
                  : activeElsewhere
                    ? "Battle active elsewhere"
                    : "Battle opened elsewhere"}
            </h1>
            <p>
              {connectionState === "checking"
                ? "Making sure this screen can safely control your battle."
                : failed
                  ? "Your battle is safe. Try connecting again when you're ready."
                  : activeElsewhere
                    ? "Another tab or device currently controls this battle."
                    : "This screen can no longer control the battle."}
            </p>
            <div>
              {activeElsewhere ? (
                <Button onClick={continueHere} disabled={pending}>
                  {pending ? "Continuing…" : "Continue here"}
                </Button>
              ) : null}
              {failed ? (
                <Button
                  onClick={() => {
                    setMessage("");
                    setConnectionState("checking");
                    setConnectionAttempt((attempt) => attempt + 1);
                  }}
                >
                  Try Again
                </Button>
              ) : null}
              {connectionState !== "checking" ? (
                <Button variant="secondary" onClick={() => router.push("/")}>
                  Return Home
                </Button>
              ) : null}
            </div>
            {message ? <small>{message}</small> : null}
          </section>
        </section>
      </main>
    );
  }

  function continueToLobby() {
    startTransition(async () => {
      const result = await continueFromBattleAction();
      if (!result.ok) return setMessage(result.message);
      router.push(result.destination === "home" ? "/" : "/battle?returned=1");
      router.refresh();
    });
  }

  if (battle.waitingForPlayers) {
    const connected = battle.players.filter((player) => player.connected).length;
    return (
      <main className={styles.page}>
        <section className={styles.screen}>
          <BattleHeader />
          <section className={styles.waitingScreen} aria-live="polite">
            <span className={styles.waitingMark} aria-hidden="true">
              <Swords />
            </span>
            <h1>Waiting for players</h1>
            <p>The round timer starts only after everyone reaches this screen.</p>
            <strong>
              {connected}/{battle.playerCount} connected
            </strong>
            <div className={styles.arrivalList}>
              {battle.players.map((player) => (
                <span className={player.connected ? styles.arrived : undefined} key={player.id}>
                  <Avatar name={playerName(player)} imageUrl={player.avatarUrl} size="small" />
                  {playerName(player)} {player.id === battle.viewer.id ? "· You" : ""}
                  <i aria-hidden="true" />
                  {player.connected ? "Connected" : "Joining…"}
                </span>
              ))}
            </div>
            <small>Arrival window: {Math.ceil(phaseSeconds)}s</small>
          </section>
          {reconnecting ? <div className={styles.connectionNotice}>Reconnecting…</div> : null}
        </section>
      </main>
    );
  }

  if (battle.phase === "between_rounds") {
    return (
      <main className={styles.page}>
        <section className={styles.screen}>
          <BattleHeader onExit={() => setExitOpen(true)} />
          <RoundStandings battle={battle} seconds={phaseSeconds} />
          {exitOpen ? (
            <ExitDialog
              playerCount={battle.playerCount}
              onStay={() => setExitOpen(false)}
              onExit={exitBattle}
            />
          ) : null}
        </section>
      </main>
    );
  }

  if (battle.phase === "battle_complete") {
    return (
      <main className={styles.page}>
        <section className={styles.screen}>
          <BattleHeader />
          <BattleComplete battle={battle} onContinue={continueToLobby} pending={pending} />
          {message ? <p className={styles.message}>{message}</p> : null}
        </section>
      </main>
    );
  }

  if (battle.phase === "voided") {
    return (
      <main className={styles.page}>
        <section className={styles.screen}>
          <BattleHeader />
          <section className={styles.voided}>
            <X aria-hidden="true" />
            <h1>Battle voided</h1>
            <p>Too few players remained connected. No statistics were recorded.</p>
            <Button onClick={continueToLobby} disabled={pending}>
              Return Home
            </Button>
          </section>
        </section>
      </main>
    );
  }

  const spectating = battle.viewer.roundStatus !== "active";
  return (
    <main className={styles.page}>
      <section className={styles.screen}>
        <BattleHeader onExit={() => setExitOpen(true)} />
        <div className={styles.battleStatus}>
          <span>
            You · {battle.viewer.points} pts · #{battle.viewer.rank}
          </span>
          <strong className={roundSeconds <= 10 ? styles.urgent : ""}>
            {formatBattleClock(roundSeconds)}
          </strong>
          <span>
            {battle.isSuddenDeath
              ? `Sudden Death · Round ${battle.suddenDeathRound}`
              : `Round ${battle.currentRound}/${battle.rounds}`}
          </span>
        </div>
        {spectating ? (
          <p className={styles.finishedNote}>
            Your puzzle is finished · Opponent letters are now visible
          </p>
        ) : null}
        <section className={`${styles.arena} ${spectating ? styles.spectating : ""}`}>
          <div className={styles.ownGame}>
            <GameBoard tiles={tiles} label="Your Friendly Battle puzzle" />
            {!spectating ? (
              <>
                <p className={styles.message} aria-live="polite">
                  {message}
                </p>
                <Keyboard
                  onKey={handleKey}
                  letterStates={letterStates}
                  disabled={!acceptingInput || submitting}
                />
              </>
            ) : (
              <strong className={styles.ownTime}>
                Time Taken: {formatCentiseconds(battle.viewer.completionCentiseconds)}
              </strong>
            )}
          </div>
          <aside
            className={`${styles.opponents} ${opponents.length > 1 ? styles.opponentGrid : styles.singleOpponent}`}
          >
            {opponents.map((opponent) => {
              const finished = opponent.roundStatus === "solved";
              const disconnected = !opponent.connected;
              return (
                <article className={styles.opponentCard} key={opponent.id}>
                  <header className={styles.opponentHeader}>
                    <strong title={playerName(opponent)}>{playerName(opponent)}</strong>
                    <span>#{opponent.rank}</span>
                  </header>
                  <div className={styles.opponentBoard}>
                    <GameBoard
                      tiles={guessTiles(opponent.guesses)}
                      compact
                      label={`${playerName(opponent)}'s puzzle`}
                    />
                  </div>
                  {finished ? (
                    <div
                      className={`${styles.cardOverlay} ${styles.finished} ${disconnected ? styles.finishedSplit : ""}`}
                    >
                      <strong>{placementLabel(opponent.roundRank ?? opponent.rank)}</strong>
                      <span>Time Taken: {formatCentiseconds(opponent.completionCentiseconds)}</span>
                    </div>
                  ) : null}
                  {disconnected ? (
                    <div
                      className={`${styles.cardOverlay} ${styles.disconnected} ${finished ? styles.disconnectedSplit : ""}`}
                    >
                      <strong>Disconnected</strong>
                      {battle.playerCount === 2 ? (
                        <span>
                          {Math.ceil(secondsUntil(opponent.reconnectDeadline, clock, serverOffset))}
                          s
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </aside>
        </section>
        {battle.preservationDeadline ? (
          <div className={styles.preservationNotice} role="status">
            Waiting for another player · Battle preserved for{" "}
            {Math.ceil(secondsUntil(battle.preservationDeadline, clock, serverOffset))}s
          </div>
        ) : null}
        {battle.phase === "round_starting" ? (
          <div className={styles.countdownOverlay} aria-live="assertive">
            <span>
              {battle.isSuddenDeath
                ? `Sudden Death Round ${battle.suddenDeathRound}`
                : `Round ${battle.currentRound}`}
            </span>
            <strong>{phaseSeconds > 0 ? Math.max(1, Math.ceil(phaseSeconds)) : "Starting…"}</strong>
          </div>
        ) : null}
        {reconnecting ? <div className={styles.connectionNotice}>Reconnecting…</div> : null}
        {battle.viewer.becameHostAt &&
        clock + serverOffset - Date.parse(battle.viewer.becameHostAt) < 5000 ? (
          <div className={`${styles.connectionNotice} ${styles.hostNotice}`}>
            You are now the host
          </div>
        ) : null}
        {exitOpen ? (
          <ExitDialog
            playerCount={battle.playerCount}
            onStay={() => setExitOpen(false)}
            onExit={exitBattle}
          />
        ) : null}
      </section>
    </main>
  );
}

function BattleHeader({ onExit }: { onExit?: () => void }) {
  return (
    <header className={styles.header}>
      <WrdlLogo size="small" />
      <strong>Friendly Battle</strong>
      {onExit ? (
        <button type="button" className={styles.exit} onClick={onExit}>
          <LogOut aria-hidden="true" />
          <span>Exit Battle</span>
        </button>
      ) : (
        <span />
      )}
    </header>
  );
}

function ExitDialog({
  playerCount,
  onStay,
  onExit,
}: {
  playerCount: number;
  onStay: () => void;
  onExit: () => void;
}) {
  return (
    <div className={styles.dialogLayer} onMouseDown={onStay}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.dialogTitle}>
          <Swords aria-hidden="true" />
          <h2>Exit this battle?</h2>
        </div>
        <p>
          {playerCount === 2
            ? "You have 30 seconds to rejoin before your opponent wins the battle."
            : "You may rejoin while this battle remains active. If fewer than two players stay connected, the battle may be voided after 20 seconds."}
        </p>
        <div className={styles.dialogActions}>
          <Button variant="secondary" onClick={onStay}>
            Stay
          </Button>
          <Button variant="danger" onClick={onExit}>
            Exit Battle
          </Button>
        </div>
      </section>
    </div>
  );
}
