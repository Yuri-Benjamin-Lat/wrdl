"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { validateUsernameFormat } from "@/lib/username";
import styles from "./entry.module.css";

export function UsernameSetupForm() {
  const [username, setUsername] = useState("");
  const [touched, setTouched] = useState(false);
  const validation = validateUsernameFormat(username);

  return (
    <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
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
        className={`${styles.validation} ${touched && !validation.valid ? styles.error : ""}`}
        id="username-validation"
        aria-live="polite"
      >
        {touched ? (
          <>
            <span className={styles.validationDot} aria-hidden="true" />
            <span>{validation.message}</span>
          </>
        ) : null}
      </div>
      <div className={styles.note} id="username-note">
        You can change your username again after 90 days.
      </div>
      <Button fullWidth type="submit" disabled={!validation.valid}>
        Continue
      </Button>
    </form>
  );
}
