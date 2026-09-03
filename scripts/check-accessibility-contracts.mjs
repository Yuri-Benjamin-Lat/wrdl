import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const appRoot = join(root, "apps", "web", "src");

function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [path];
  });
}

const findings = [];
const componentFiles = filesBelow(appRoot).filter((file) => extname(file) === ".tsx");

for (const file of componentFiles) {
  const content = readFileSync(file, "utf8");
  const displayPath = relative(root, file);

  if (content.includes("<AppShell") && /<main\b/.test(content)) {
    findings.push(`${displayPath}: nests a second main landmark inside AppShell`);
  }

  const untypedButtons = content.match(/<button\b(?![^>]*\btype=)[^>]*>/gs) ?? [];
  if (untypedButtons.length > 0) {
    findings.push(`${displayPath}: ${untypedButtons.length} raw button(s) omit an explicit type`);
  }

  const imagesWithoutAlt = content.match(/<img\b(?![^>]*\balt=)[^>]*>/gs) ?? [];
  if (imagesWithoutAlt.length > 0) {
    findings.push(`${displayPath}: ${imagesWithoutAlt.length} image(s) omit alt text`);
  }
}

const rootLayout = readFileSync(join(appRoot, "app", "layout.tsx"), "utf8");
if (!/<html\s+lang=["']en["']/.test(rootLayout)) {
  findings.push("apps/web/src/app/layout.tsx: document language is missing or unexpected");
}

if (findings.length > 0) {
  console.error("Accessibility contract check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Accessibility contract check passed for ${componentFiles.length} TSX files.`);
