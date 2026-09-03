import { randomInt } from "node:crypto";

import { ALLOWED_GUESSES, FREE_PLAY_WORDS } from "@wrdl/game-core/catalog";

import { getSupabaseServerClient } from "@/lib/supabase/server-client";

type RoundRequest = {
  includeRare?: unknown;
  previousAnswer?: unknown;
};

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ message: "Authentication required." }, { status: 401 });
  }

  let body: RoundRequest;
  try {
    body = (await request.json()) as RoundRequest;
  } catch {
    return Response.json({ message: "Invalid request." }, { status: 400 });
  }

  const includeRare = body.includeRare === true;
  const previousAnswer = typeof body.previousAnswer === "string" ? body.previousAnswer : null;
  const eligible = includeRare
    ? FREE_PLAY_WORDS
    : FREE_PLAY_WORDS.filter((entry) => entry.rarity === "common");
  const withoutImmediateRepeat = eligible.filter((entry) => entry.word !== previousAnswer);
  const selectionPool = withoutImmediateRepeat.length > 0 ? withoutImmediateRepeat : eligible;
  const selected = selectionPool[randomInt(selectionPool.length)];

  const { error: preferenceError } = await supabase
    .from("user_settings")
    .update({
      free_play_rare_enabled: includeRare,
    })
    .eq("user_id", user.id);

  if (preferenceError) {
    return Response.json({ message: "Your word-pool choices couldn’t be saved." }, { status: 503 });
  }

  return Response.json(
    {
      answer: selected.word,
      rarity: selected.rarity,
      acceptedWords: Array.from(ALLOWED_GUESSES),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
