"use client";

import { useEffect } from "react";

import { reportApplicationError } from "@/lib/observability";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportApplicationError("app_render_failed", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Fredoka, system-ui, sans-serif" }}>
        <main
          style={{
            minHeight: "100dvh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            color: "#172820",
            background: "#fbf9f2",
          }}
        >
          <section style={{ width: "min(100%, 560px)", textAlign: "center" }}>
            <h1>We couldn&apos;t load WRDL</h1>
            <p>Please try again. Your saved progress is safe.</p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 12,
                padding: "13px 20px",
                border: 0,
                borderRadius: 12,
                color: "#fffdf7",
                background: "#4f865c",
                font: "inherit",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
