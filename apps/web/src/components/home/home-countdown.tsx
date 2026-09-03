"use client";

import { manilaDateKey, nextManilaReset } from "@wrdl/game-core";
import { useEffect, useState } from "react";

import { formatDailyCountdown } from "@/lib/daily";

export function HomeCountdown() {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (now === null) return <span>Next puzzle --:--:--</span>;

  const resetAt = nextManilaReset(manilaDateKey(now)).getTime();

  return <span>Next puzzle {formatDailyCountdown(resetAt - now)}</span>;
}
