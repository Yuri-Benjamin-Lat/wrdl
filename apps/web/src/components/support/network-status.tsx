"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import styles from "./supporting-states.module.css";

type NetworkState = "online" | "offline" | "restored";

export function NetworkStatus() {
  const [state, setState] = useState<NetworkState>("online");
  const wasOffline = useRef(false);
  const restoredTimer = useRef<number | null>(null);

  useEffect(() => {
    const showOffline = () => {
      wasOffline.current = true;
      if (restoredTimer.current) window.clearTimeout(restoredTimer.current);
      setState("offline");
    };
    const showOnline = () => {
      if (!wasOffline.current) return setState("online");
      wasOffline.current = false;
      setState("restored");
      if (restoredTimer.current) window.clearTimeout(restoredTimer.current);
      restoredTimer.current = window.setTimeout(() => setState("online"), 2000);
    };

    if (!navigator.onLine) showOffline();
    window.addEventListener("offline", showOffline);
    window.addEventListener("online", showOnline);
    return () => {
      window.removeEventListener("offline", showOffline);
      window.removeEventListener("online", showOnline);
      if (restoredTimer.current) window.clearTimeout(restoredTimer.current);
    };
  }, []);

  if (state === "online") return null;
  return (
    <div
      className={`${styles.networkStatus} ${state === "offline" ? styles.networkOffline : styles.networkRestored}`}
      role="status"
      aria-live="polite"
    >
      {state === "offline" ? <WifiOff aria-hidden="true" /> : <Wifi aria-hidden="true" />}
      <span>{state === "offline" ? "You're offline" : "Back online"}</span>
    </div>
  );
}
