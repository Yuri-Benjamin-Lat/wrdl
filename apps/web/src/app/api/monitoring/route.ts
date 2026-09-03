import { isWrdlErrorEvent } from "@/lib/observability";
import { reportServerApplicationError } from "@/lib/observability.server";
import { getSupabaseServerClient } from "@/lib/supabase/server-client";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  if (request.headers.get("origin") !== requestUrl.origin) {
    return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(contentLength) || contentLength > 1024) {
    return Response.json({ error: "Request is too large." }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof payload !== "object" || payload === null || !("event" in payload)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const event = payload.event;
  const digest = "digest" in payload ? payload.digest : undefined;
  if (!isWrdlErrorEvent(event)) {
    return Response.json({ error: "Invalid event." }, { status: 400 });
  }
  if (
    digest !== undefined &&
    (typeof digest !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(digest))
  ) {
    return Response.json({ error: "Invalid digest." }, { status: 400 });
  }

  reportServerApplicationError(event, digest ? { digest } : undefined);
  return new Response(null, { status: 204 });
}
