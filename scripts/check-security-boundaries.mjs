import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const appRoot = join(root, "apps", "web", "src");
const migrationsRoot = join(root, "supabase", "migrations");

function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

const findings = [];
const sourceFiles = filesBelow(appRoot).filter((file) => [".ts", ".tsx"].includes(extname(file)));
const source = sourceFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const migrations = filesBelow(migrationsRoot)
  .filter((file) => extname(file) === ".sql")
  .map((file) => readFileSync(file, "utf8"))
  .join("\n")
  .toLowerCase();

for (const route of sourceFiles.filter((file) => file.endsWith("route.ts"))) {
  const content = readFileSync(route, "utf8");
  if (
    content.includes("export async function POST") &&
    !content.includes("auth.getUser") &&
    !content.includes("requireUser()")
  ) {
    findings.push(`${relative(root, route)}: POST handler has no visible authenticated-user check`);
  }
}

for (const file of sourceFiles) {
  const content = readFileSync(file, "utf8");
  if (content.includes("console.error") && !file.endsWith(join("lib", "observability.ts"))) {
    findings.push(`${relative(root, file)}: bypasses the privacy-safe error reporter`);
  }
}

const forbiddenSourcePatterns = [
  ["server secret environment variable", /SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY/],
  ["service-role client", /service[_-]?role/i],
  ["direct private-schema query", /\.schema\(["']private["']\)/],
];

for (const [label, pattern] of forbiddenSourcePatterns) {
  if (pattern.test(source)) findings.push(`application source contains a ${label}`);
}

const requiredMigrationControls = [
  ["private avatar bucket", "'avatars', 'avatars', false"],
  ["avatar size limit", "file_size_limit"],
  ["avatar MIME allowlist", "allowed_mime_types"],
  ["profiles RLS", "alter table public.profiles enable row level security"],
  ["social RLS", "alter table public.friendships enable row level security"],
  ["party invitation RLS", "alter table public.party_invitations enable row level security"],
  ["battle RLS", "alter table public.battles enable row level security"],
  ["battle guess RLS", "alter table public.battle_guesses enable row level security"],
  ["protected battle answers", "alter table private.battle_rounds enable row level security"],
  ["Daily replay protection", "create table public.daily_guesses"],
  ["battle replay protection", "create table public.battle_guesses"],
  ["unique command IDs", "command_id uuid not null unique"],
];

for (const [label, marker] of requiredMigrationControls) {
  if (!migrations.includes(marker.toLowerCase())) findings.push(`migration history lacks ${label}`);
}

const securityHeaderFile = readFileSync(join(appRoot, "lib", "security-headers.ts"), "utf8");
for (const marker of [
  "object-src 'none'",
  "frame-ancestors 'none'",
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "Strict-Transport-Security",
]) {
  if (!securityHeaderFile.includes(marker)) findings.push(`security headers lack ${marker}`);
}

if (findings.length > 0) {
  console.error("Security boundary check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  `Security boundary check passed for ${sourceFiles.length} application files and the complete migration history.`,
);
