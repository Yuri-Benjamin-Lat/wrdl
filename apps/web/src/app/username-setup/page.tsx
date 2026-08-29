import { EntryScreen } from "@/components/entry/entry-screen";
import { UsernameSetupForm } from "@/components/entry/username-setup-form";
import { requireSignedInAccount } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function UsernameSetupPage() {
  const account = await requireSignedInAccount();
  if (account.profile.username) redirect("/");

  return (
    <EntryScreen
      title="Choose your username"
      description="This is how friends will find and recognize you."
    >
      <UsernameSetupForm />
    </EntryScreen>
  );
}
