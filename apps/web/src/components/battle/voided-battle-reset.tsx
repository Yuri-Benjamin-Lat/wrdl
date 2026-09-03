"use client";

import { Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { continueFromBattleAction } from "@/app/battle/actions";
import { WrdlLogo } from "@/components/brand/wrdl-logo";
import { Button } from "@/components/ui/button";
import styles from "./battle-experience.module.css";

export function VoidedBattleReset() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const started = useRef(false);

  const reset = useCallback(() => {
    setMessage("");
    void (async () => {
      const result = await continueFromBattleAction();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      router.refresh();
    })();
  }, [router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    reset();
  }, [reset]);

  return (
    <main className={styles.page}>
      <section className={styles.screen}>
        <header className={styles.header}>
          <WrdlLogo size="small" />
          <strong>Friendly Battle</strong>
          <span />
        </header>
        <section className={styles.waitingScreen} aria-live="polite">
          <span className={styles.waitingMark} aria-hidden="true">
            <Swords />
          </span>
          <h1>Preparing your lobby…</h1>
          <p>The voided battle has ended. Starting a fresh lobby.</p>
          {message ? <Button onClick={reset}>Try Again</Button> : null}
          {message ? <small>{message}</small> : null}
        </section>
      </section>
    </main>
  );
}
