import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/fredoka/wght.css";

import { NetworkStatus } from "@/components/support/network-status";
import { MaintenanceState } from "@/components/support/supporting-state";
import { ThemeBootstrap } from "@/components/support/theme-bootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "WRDL",
  description: "Daily word puzzles and friendly competition.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const maintenance = process.env.WRDL_MAINTENANCE_MODE === "true";
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeBootstrap />
        {maintenance ? <MaintenanceState /> : children}
        {!maintenance ? <NetworkStatus /> : null}
      </body>
    </html>
  );
}
