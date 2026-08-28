import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import { spawnSync } from "node:child_process";

const trackedFilesResult = spawnSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
});

if (trackedFilesResult.status !== 0) {
  console.error("Unable to list tracked files for secret scanning.");
  process.exit(1);
}

const trackedFiles = trackedFilesResult.stdout.split("\0").filter(Boolean);
const permittedEnvironmentTemplates = /(^|\/)\.env(?:\.[^/]+)?\.example$/;
const forbiddenEnvironmentFile = /(^|\/)\.env(?:\.[^/]+)?$/;
const textExtensions = new Set([
  "",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const secretRules = [
  { name: "Supabase secret key", pattern: /sb_secret_[A-Za-z0-9_-]{16,}/ },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  {
    name: "credential-bearing Postgres URL",
    pattern: /postgres(?:ql)?:\/\/[^\s:/]+:[^\s@/]+@/i,
  },
  {
    name: "assigned server-side Supabase secret",
    pattern:
      /SUPABASE_(?:SECRET|SERVICE_ROLE)_KEY\s*=\s*(?!replace-|example|$)[^\s]+/i,
  },
];

const findings = [];

for (const file of trackedFiles) {
  const normalizedFile = file.replaceAll("\\", "/");

  if (
    forbiddenEnvironmentFile.test(normalizedFile) &&
    !permittedEnvironmentTemplates.test(normalizedFile)
  ) {
    findings.push({ file, rule: "tracked environment file" });
    continue;
  }

  if (!textExtensions.has(extname(file).toLowerCase())) continue;
  if (statSync(file).size > 2_000_000) continue;

  const content = readFileSync(file, "utf8");
  for (const rule of secretRules) {
    if (rule.pattern.test(content)) findings.push({ file, rule: rule.name });
  }
}

if (findings.length > 0) {
  console.error("Potential committed secrets detected:");
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.rule}`);
  }
  process.exit(1);
}

console.log(`Secret scan passed for ${trackedFiles.length} tracked files.`);
