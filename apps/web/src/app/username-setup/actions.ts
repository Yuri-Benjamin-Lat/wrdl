"use server";

import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";
import { validateUsernameFormat } from "@/lib/username";

export type UsernameActionState = {
  status: "idle" | "error";
  message: string;
};

export async function completeUsernameAction(
  _state: UsernameActionState,
  formData: FormData,
): Promise<UsernameActionState> {
  const username = String(formData.get("username") ?? "");
  const validation = validateUsernameFormat(username);

  if (!validation.valid) {
    return { status: "error", message: validation.message };
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { error } = await supabase.rpc("complete_my_profile", { candidate: username });
  if (error) {
    const unavailable = error.code === "23505" || /unavailable/i.test(error.message);
    return {
      status: "error",
      message: unavailable
        ? "That username was just taken. Please choose another one."
        : "We couldn’t save your username. Please try again.",
    };
  }

  redirect("/");
}
