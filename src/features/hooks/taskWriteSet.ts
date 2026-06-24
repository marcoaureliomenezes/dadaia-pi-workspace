import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ReservedTaskWriteSet {
  readonly taskLine: string;
  readonly patterns: readonly string[];
}

function normalize(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function escapeRegex(value: string): string {
  return value.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

function patternToRegex(pattern: string): RegExp {
  const normalized = normalize(pattern);
  let source = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += escapeRegex(char ?? "");
    }
  }
  return new RegExp(`^${source}$`);
}

export function matchesWriteSet(path: string, patterns: readonly string[]): boolean {
  const normalized = normalize(path);
  return patterns.some((pattern) => patternToRegex(pattern).test(normalized));
}

function parseBacktickPatterns(line: string): string[] {
  return [...line.matchAll(/`([^`]+)`/g)].map((match) => normalize(match[1] ?? "")).filter(Boolean);
}

export function parseReservedTaskWriteSet(tasksText: string): ReservedTaskWriteSet | undefined {
  const lines = tasksText.split(/\r?\n/);
  const reservedIndexes = lines.map((line, index) => ({ line, index })).filter((item) => /^- \[-\] /.test(item.line));
  if (reservedIndexes.length !== 1) return undefined;
  const reserved = reservedIndexes[0];
  if (!reserved) return undefined;
  const nextTaskIndex = lines.findIndex((line, index) => index > reserved.index && /^- \[[ x-]\] /.test(line));
  const end = nextTaskIndex >= 0 ? nextTaskIndex : lines.length;
  const block = lines.slice(reserved.index + 1, end);
  const writeSetLine = block.find((line) => /Write set:/i.test(line));
  const patterns = writeSetLine ? parseBacktickPatterns(writeSetLine) : [];
  return { taskLine: reserved.line, patterns };
}

export async function readReservedTaskWriteSet(repoRoot: string, release: string): Promise<ReservedTaskWriteSet | undefined> {
  const text = await readFile(join(repoRoot, "specs", "releases", release, "TASKS.md"), "utf8");
  return parseReservedTaskWriteSet(text);
}
