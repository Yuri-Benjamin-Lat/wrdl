"use client";

import { ArrowRight, CircleX, Radio } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { continueFromBattleAction } from "@/app/battle/actions";
import styles from "./home-battle-status.module.css";

export type HomeBattleStatusKind = "active" | "voided" | null;

export function HomeBattleStatus({ initialStatus }: { initialStatus: HomeBattleStatusKind }) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (status !== "active") return;
    let mounted = true;
    let loading = false;

    const refresh = () => {
      if (loading) return;
      loading = true;
      void (async () => {
        try {
          const response = await fetch("/api/battle/status", { cache: "no-store" });
          if (!response.ok) return;
          const payload = (await response.json()) as { status?: unknown };
          if (
            mounted &&
            (payload.status === "active" || payload.status === "voided" || payload.status === null)
          ) {
            setStatus(payload.status);
          }
        } catch {
          // The next background check retries without disturbing the Home controls.
        } finally {
          loading = false;
        }
      })();
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = window.setInterval(refresh, 1_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [status]);

  useEffect(() => {
    if (status !== "voided") return;
    const timer = window.setTimeout(() => {
      setStatus(null);
      void continueFromBattleAction();
    }, 5_000);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (!status) return null;
  const voided = status === "voided";
  if (voided) {
    return (
      <div className={`${styles.card} ${styles.voided}`} role="status" aria-live="polite">
        <span className={styles.icon} aria-hidden="true">
          <CircleX />
        </span>
        <span className={styles.copy}>
          <strong>Battle voided</strong>
          <small>No players remained.</small>
        </span>
      </div>
    );
  }
  return (
    <Link className={styles.card} href="/battle" prefetch={false} aria-live="polite">
      <span className={styles.icon} aria-hidden="true">
        <Radio />
      </span>
      <span className={styles.copy}>
        <strong>Friendly Battle in progress</strong>
        <small>Rejoin your active match</small>
      </span>
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}
