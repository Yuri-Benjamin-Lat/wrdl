import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/fredoka/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "WRDL",
  description: "Daily word puzzles and friendly competition.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
