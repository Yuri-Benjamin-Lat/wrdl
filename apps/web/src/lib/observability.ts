export const wrdlErrorEvents = [
  "app_render_failed",
  "battle_snapshot_invalid",
  "battle_snapshot_unavailable",
  "page_render_failed",
] as const;

export type WrdlErrorEvent = (typeof wrdlErrorEvents)[number];

export function isWrdlErrorEvent(value: unknown): value is WrdlErrorEvent {
  return typeof value === "string" && wrdlErrorEvents.some((event) => event === value);
}

export function safeDigest(error: unknown) {
  if (typeof error !== "object" || error === null || !("digest" in error)) return null;
  const digest = error.digest;
  if (typeof digest !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(digest)) return null;
  return digest;
}

export function reportApplicationError(event: WrdlErrorEvent, error?: unknown) {
  const digest = safeDigest(error);
  const payload = { event, ...(digest ? { digest } : {}) };

  if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
    void fetch("/api/monitoring", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  }

  console.error(
    JSON.stringify({
      level: "error",
      ...payload,
    }),
  );
}
