"use client";

import { useEffect } from "react";

import type { WrdlTheme } from "@/lib/database.types";

export function PreferencesSync({
  theme,
  highContrast,
}: {
  theme: WrdlTheme;
  highContrast: boolean;
}) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.dataset.theme = theme;
    root.toggleAttribute("data-high-contrast", highContrast);
    localStorage.setItem("wrdl-theme", theme);
    localStorage.setItem("wrdl-high-contrast", String(highContrast));
  }, [highContrast, theme]);

  return null;
}
