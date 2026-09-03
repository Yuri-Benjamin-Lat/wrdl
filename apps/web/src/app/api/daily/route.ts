import { parseDailySnapshot } from "@/lib/daily";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

type GuessRequest = {
  commandId?: unknown;
  guess?: unknown;
};

type SafeDailyError = {
  message: string;
  status: number;
};

function dailyError(message: string, fallbackStatus = 503): SafeDailyError {
  const normalized = message.toLocaleLowerCase("en-US");
  if (normalized.includes("authentication")) {
    return { message: "Authentication required.", status: 401 };
  }
  if (normalized.includes("five letters")) {
    return { message: "Guess must contain exactly five letters.", status: 400 };
  }
  if (normalized.includes("accepted list")) {
    return { message: "Not in word list.", status: 400 };
  }
  if (normalized.includes("already complete")) {
    return { message: "Daily puzzle is already complete.", status: 409 };
  }
  if (normalized.includes("no daily guesses")) {
    return { message: "No Daily guesses remain.", status: 409 };
  }
  if (normalized.includes("voided")) {
    return { message: "Daily puzzle has been voided.", status: 409 };
  }
  if (normalized.includes("no rows") || normalized.includes("unavailable")) {
    return { message: "Today's Daily Wordle is unavailable.", status: 503 };
  }
  return {
    message: "Daily Wordle could not be reached. Please try again.",
    status: fallbackStatus,
  };
}

async function requireUser() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return Response.json({ message: "Authentication required." }, { status: 401 });

  const { data, error } = await supabase.rpc("get_my_daily_snapshot");
  if (error) {
    const safeError = dailyError(error.message);
    return Response.json({ message: safeError.message }, { status: safeError.status });
  }

  try {
    return Response.json(parseDailySnapshot(data), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "Daily puzzle returned an unsafe response." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return Response.json({ message: "Authentication required." }, { status: 401 });

  let body: GuessRequest;
  try {
    body = (await request.json()) as GuessRequest;
  } catch {
    return Response.json({ message: "Invalid request." }, { status: 400 });
  }

  if (
    typeof body.commandId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.commandId,
    ) ||
    typeof body.guess !== "string"
  ) {
    return Response.json({ message: "Invalid Daily guess request." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("submit_my_daily_guess", {
    command_id: body.commandId,
    submitted_guess: body.guess,
  });

  if (error) {
    const safeError = dailyError(error.message, 503);
    return Response.json({ message: safeError.message }, { status: safeError.status });
  }

  try {
    return Response.json(parseDailySnapshot(data), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "Daily puzzle returned an unsafe response." }, { status: 502 });
  }
}
