import { EntryScreen, entryStyles } from "@/components/entry/entry-screen";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <EntryScreen title="Welcome to Wordle" description="Daily puzzles and friendly competition.">
      <Button
        className={entryStyles.googleButton}
        type="button"
        icon={<span className={entryStyles.googleMark}>G</span>}
      >
        Sign in with Google
      </Button>
    </EntryScreen>
  );
}
