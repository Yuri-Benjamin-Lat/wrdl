const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !publishableKey) {
  console.error(
    "Missing hosted Supabase configuration. Create apps/web/.env.local from the development example.",
  );
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(supabaseUrl);
} catch {
  console.error("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
  process.exit(1);
}

if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname.endsWith(".supabase.co")) {
  console.error("WRDL must connect to a hosted HTTPS Supabase project.");
  process.exit(1);
}

if (!publishableKey.startsWith("sb_publishable_")) {
  console.error("WRDL requires a browser-safe Supabase publishable key.");
  process.exit(1);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

try {
  const response = await fetch(new URL("/auth/v1/health", parsedUrl), {
    headers: { apikey: publishableKey },
    signal: controller.signal,
  });

  if (!response.ok) {
    throw new Error(`hosted backend returned HTTP ${response.status}`);
  }

  console.log(`Connected to the authorized hosted Supabase project (${parsedUrl.hostname}).`);
} catch (error) {
  const reason = error instanceof Error ? error.message : "unknown error";
  console.error(`Unable to reach the hosted Supabase project: ${reason}`);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
