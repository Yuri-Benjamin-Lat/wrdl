import "server-only";

import * as Sentry from "@sentry/nextjs";

import { reportApplicationError, safeDigest, type WrdlErrorEvent } from "./observability";

export function reportServerApplicationError(event: WrdlErrorEvent, error?: unknown) {
  const digest = safeDigest(error);
  Sentry.captureMessage(event, {
    level: "error",
    tags: { wrdl_event: event },
    ...(digest ? { extra: { digest } } : {}),
  });
  reportApplicationError(event, error);
}
