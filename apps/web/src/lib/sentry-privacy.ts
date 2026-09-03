import type { ErrorEvent } from "@sentry/nextjs";

const safeErrorMessage = "WRDL application error";

export function redactSentryEvent(event: ErrorEvent): ErrorEvent {
  const redacted = { ...event };

  redacted.user = undefined;
  redacted.request = undefined;
  redacted.breadcrumbs = undefined;
  redacted.contexts = undefined;
  redacted.extra = undefined;
  redacted.fingerprint = undefined;
  redacted.transaction = undefined;
  redacted.tags = { privacy: "redacted" };
  if (redacted.message) redacted.message = safeErrorMessage;

  if (redacted.exception?.values) {
    redacted.exception = {
      ...redacted.exception,
      values: redacted.exception.values.map((value) => ({
        ...value,
        value: safeErrorMessage,
        stacktrace: value.stacktrace
          ? {
              ...value.stacktrace,
              frames: value.stacktrace.frames?.map((frame) => ({
                filename: frame.filename,
                function: frame.function,
                module: frame.module,
                lineno: frame.lineno,
                colno: frame.colno,
                in_app: frame.in_app,
              })),
            }
          : undefined,
      })),
    };
  }

  return redacted;
}
