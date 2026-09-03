"use client";

import { useEffect } from "react";

export function ActivityHeartbeat() {
  useEffect(() => {
    const touch = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/activity", {
          method: "POST",
          cache: "no-store",
        });
        if (response.ok) window.dispatchEvent(new Event("wrdl:activity-touched"));
      } catch {
        // Presence is best-effort and retries on the next heartbeat or focus.
      }
    };

    void touch();
    const interval = window.setInterval(touch, 3 * 60 * 1000);
    const handleVisibility = () => void touch();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
