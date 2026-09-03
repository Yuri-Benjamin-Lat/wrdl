import { spawnSync } from "node:child_process";

const checks = [
  ["secret scan", "secrets:check"],
  ["security boundaries", "security:check"],
  ["accessibility contracts", "accessibility:check"],
  ["formatting", "format:check"],
  ["word catalog", "catalog:check"],
  ["Daily catalog", "daily-catalog:check"],
  ["lint", "lint"],
  ["type checking", "typecheck"],
  ["tests", "test"],
  ["production build", "build"],
  ["bundle budget", "performance:check"],
];

for (const [label, script] of checks) {
  console.log(`\n[release] ${label}`);
  const result = spawnSync("pnpm", [script], { stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("\nWRDL release check passed.");
