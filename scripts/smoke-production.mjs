const inputUrl = process.env.WRDL_PRODUCTION_URL ?? process.argv[2];

if (!inputUrl) {
  console.error("Set WRDL_PRODUCTION_URL or pass the production origin as the first argument.");
  process.exit(1);
}

let origin;
try {
  const parsed = new URL(inputUrl);
  if (parsed.protocol !== "https:") throw new Error("Production must use HTTPS.");
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("Use a bare production origin without credentials, query, or fragment.");
  }
  origin = parsed.origin;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid production URL.");
  process.exit(1);
}

const routes = [
  { path: "/", statuses: [200] },
  { path: "/sign-in", statuses: [200], html: true },
  { path: "/maintenance", statuses: [200], html: true },
  { path: "/icon.svg", statuses: [200] },
  { path: "/api/activity", method: "POST", statuses: [401], privateApi: true },
];

const requiredSecurityHeaders = new Map([
  ["content-security-policy", "frame-ancestors 'none'"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["x-content-type-options", "nosniff"],
  ["x-frame-options", "DENY"],
  ["permissions-policy", "camera=()"],
  ["cross-origin-opener-policy", "same-origin-allow-popups"],
  ["strict-transport-security", "max-age=63072000"],
]);

const failures = [];

for (const route of routes) {
  const startedAt = performance.now();
  let response;
  try {
    response = await fetch(`${origin}${route.path}`, {
      method: route.method ?? "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "WRDL-production-smoke/1.0" },
    });
  } catch {
    failures.push(`${route.path}: request failed`);
    continue;
  }

  const elapsed = Math.round(performance.now() - startedAt);
  console.log(`${route.path}: ${response.status} (${elapsed} ms)`);

  if (!route.statuses.includes(response.status)) {
    failures.push(`${route.path}: expected ${route.statuses.join("/")}, got ${response.status}`);
  }
  if (new URL(response.url).origin !== origin) {
    failures.push(`${route.path}: redirected outside the production origin`);
  }
  if (route.html && !response.headers.get("content-type")?.includes("text/html")) {
    failures.push(`${route.path}: expected an HTML response`);
  }
  if (route.privateApi && !response.headers.get("cache-control")?.includes("no-store")) {
    failures.push(`${route.path}: private API response is missing no-store caching`);
  }

  for (const [header, requiredValue] of requiredSecurityHeaders) {
    const actual = response.headers.get(header);
    if (!actual?.includes(requiredValue)) {
      failures.push(`${route.path}: ${header} is missing ${requiredValue}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Production smoke check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production public-surface smoke check passed.");
