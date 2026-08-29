"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { completeUsernameAction, type UsernameActionState } from "@/app/username-setup/actions";
import { validateUsernameFormat } from "@/lib/username";
import styles from "./entry.module.css";

const initialUsernameActionState: UsernameActionState = {
  status: "idle",
  message: "",
};

export function UsernameSetupForm() {
  const [username, setUsername] = useState("");
  const [touched, setTouched] = useState(false);
  const [availability, setAvailability] = useState<
    "idle" | "checking" | "available" | "unavailable" | "error"
  >("idle");
  const [state, action, pending] = useActionState(
    completeUsernameAction,
    initialUsernameActionState,
  );
  const validation = validateUsernameFormat(username);

  useEffect(() => {
    if (!touched || !validation.valid) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAvailability("checking");
      try {
        const response = await fetch(
          `/api/usernames/availability?username=${encodeURIComponent(username)}`,
          { signal: controller.signal },
        );
        const result = (await response.json()) as { available?: boolean };
        setAvailability(result.available ? "available" : "unavailable");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setAvailability("error");
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [touched, username, validation.valid]);

  const feedback = !touched
    ? ""
    : !validation.valid
      ? validation.message
      : availability === "checking"
        ? "Checking availability…"
        : availability === "available"
          ? "Username available"
          : availability === "unavailable"
            ? "Username unavailable"
            : availability === "error"
              ? "Availability couldn’t be checked"
              : "";
  const feedbackIsError =
    touched && (!validation.valid || availability === "unavailable" || availability === "error");

  return (
    <form className={styles.form} action={action}>
      <label className={styles.fieldHead} htmlFor="username">
        <span>Username</span>
        <span className={styles.count}>{username.length} / 20</span>
      </label>
      <div className={styles.inputWrap}>
        <span className={styles.prefix}>@</span>
        <input
          className={styles.input}
          id="username"
          name="username"
          value={username}
          maxLength={20}
          autoComplete="username"
          aria-describedby="username-validation username-note"
          onChange={(event) => {
            setUsername(event.target.value);
            setTouched(true);
          }}
        />
      </div>
      <div
        className={`${styles.validation} ${feedbackIsError ? styles.error : ""}`}
        id="username-validation"
        aria-live="polite"
      >
        {feedback ? (
          <>
            <span className={styles.validationDot} aria-hidden="true" />
            <span>{feedback}</span>
          </>
        ) : null}
      </div>
      {state.status === "error" ? (
        <p className={styles.formMessage} role="alert">
          {state.message}
        </p>
      ) : null}
      <div className={styles.note} id="username-note">
        You can change your username again after 90 days.
      </div>
      <Button
        fullWidth
        type="submit"
        disabled={!validation.valid || availability !== "available" || pending}
      >
        {pending ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
