import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const staticRoot = join(process.cwd(), "apps", "web", ".next", "static");
if (!existsSync(staticRoot)) {
  console.error("No production build found. Run pnpm build before the performance check.");
  process.exit(1);
}

function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

const budgets = {
  ".js": { total: 1_500_000, largest: 350_000 },
  ".css": { total: 150_000, largest: 125_000 },
};
const failures = [];
const files = filesBelow(staticRoot);

for (const [extension, budget] of Object.entries(budgets)) {
  const assets = files
    .filter((file) => extname(file) === extension)
    .map((file) => ({ file, bytes: statSync(file).size }));
  const total = assets.reduce((sum, asset) => sum + asset.bytes, 0);
  const largest = assets.sort((a, b) => b.bytes - a.bytes)[0];
  const summary = `${extension.slice(1).toUpperCase()}: ${assets.length} files, ${Math.round(total / 1024)} KiB total, ${Math.round((largest?.bytes ?? 0) / 1024)} KiB largest`;
  console.log(summary);
  if (total > budget.total) failures.push(`${summary} exceeds the total budget`);
  if ((largest?.bytes ?? 0) > budget.largest) {
    failures.push(
      `${relative(process.cwd(), largest.file)} exceeds the ${Math.round(budget.largest / 1024)} KiB single-file budget`,
    );
  }
}

if (failures.length > 0) {
  console.error("Production bundle budget failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production bundle budget passed.");
