"use client";

import { useEffect } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

export function ActivityHeartbeat() {
  useEffect(() => {
    const touch = () => {
      if (document.visibilityState === "visible") {
        void getSupabaseBrowserClient().rpc("touch_my_activity", {});
      }
    };

    touch();
    const interval = window.setInterval(touch, 3 * 60 * 1000);
    document.addEventListener("visibilitychange", touch);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", touch);
    };
  }, []);

  return null;
}
