"use client";

import { useLayoutEffect } from "react";

export function ThemeBootstrap() {
  useLayoutEffect(() => {
    try {
      const theme = window.localStorage.getItem("wrdl-theme");
      if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
      const highContrast = window.localStorage.getItem("wrdl-high-contrast");
      document.documentElement.toggleAttribute("data-high-contrast", highContrast === "true");
    } catch {
      // Storage may be unavailable in privacy-restricted browser contexts.
    }
  }, []);

  return null;
}
