#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const ignored = new Set([".git", "node_modules", "dist"]);
const checkedExtensions = new Set([".ts", ".js", ".mjs", ".json", ".md"]);
const issues = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    const dot = entry.name.lastIndexOf(".");
    const ext = dot >= 0 ? entry.name.slice(dot) : "";
    if (!checkedExtensions.has(ext)) continue;
    const text = await readFile(path, "utf8");
    const rel = relative(root, path);
    if (!text.endsWith("\n")) issues.push(`${rel}: missing trailing newline`);
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      if (/[ \t]$/.test(line)) issues.push(`${rel}:${index + 1}: trailing whitespace`);
    });
  }
}

await walk(root);

const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
for (const key of ["extensions", "skills", "prompts"]) {
  if (!Array.isArray(pkg.pi?.[key]) || pkg.pi[key].length === 0) {
    issues.push(`package.json: missing non-empty pi.${key} declaration`);
  }
}
for (const dep of [
  "@earendil-works/pi-ai",
  "@earendil-works/pi-agent-core",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
  "typebox",
]) {
  if (!pkg.peerDependencies?.[dep]) issues.push(`package.json: missing peerDependency ${dep}`);
}

if (issues.length > 0) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
}
