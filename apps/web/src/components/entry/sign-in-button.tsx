"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { entryStyles } from "./entry-screen";

export function SignInButton({ returnTo }: { returnTo?: string | null }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function signIn() {
    setPending(true);
    setMessage(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setPending(false);
      setMessage("We couldn’t start Google sign-in. Please try again.");
    }
  }

  return (
    <>
      <Button
        className={entryStyles.googleButton}
        type="button"
        icon={<span className={entryStyles.googleMark}>G</span>}
        disabled={pending}
        onClick={signIn}
      >
        {pending ? "Opening Google…" : "Sign in with Google"}
      </Button>
      {message ? (
        <p className={entryStyles.formMessage} role="alert">
          {message}
        </p>
      ) : null}
    </>
  );
}
