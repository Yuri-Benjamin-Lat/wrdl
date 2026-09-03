import { EntryScreen, entryStyles } from "@/components/entry/entry-screen";
import { SignInButton } from "@/components/entry/sign-in-button";
import { redirectForAccountState } from "@/lib/auth";

type SignInPageProps = {
  searchParams: Promise<{ error?: string; deleted?: string; next?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  await redirectForAccountState();
  const { error, deleted, next } = await searchParams;
  const returnTo = next?.startsWith("/") && !next.startsWith("//") ? next : null;

  return (
    <EntryScreen title="Welcome to Wordle" description="Daily puzzles and friendly competition.">
      {error ? (
        <p className={entryStyles.formMessage} role="alert">
          {error === "cancelled"
            ? "Sign-in was cancelled. You can try again whenever you’re ready."
            : "Google sign-in didn’t finish. Please try again."}
        </p>
      ) : null}
      {deleted ? (
        <p className={entryStyles.successMessage}>Your WRDL account was deleted.</p>
      ) : null}
      <SignInButton returnTo={returnTo} />
    </EntryScreen>
  );
}
