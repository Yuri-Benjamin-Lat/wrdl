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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('wrdl-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;var h=localStorage.getItem('wrdl-high-contrast');if(h==='true')document.documentElement.setAttribute('data-high-contrast','');}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
