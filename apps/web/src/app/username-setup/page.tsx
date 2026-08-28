import { EntryScreen } from "@/components/entry/entry-screen";
import { UsernameSetupForm } from "@/components/entry/username-setup-form";

export default function UsernameSetupPage() {
  return (
    <EntryScreen
      title="Choose your username"
      description="This is how friends will find and recognize you."
    >
      <UsernameSetupForm />
    </EntryScreen>
  );
}
