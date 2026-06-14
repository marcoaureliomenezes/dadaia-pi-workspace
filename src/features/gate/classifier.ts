import { relative, sep } from "node:path";

export type PathClass = "ADDITIVE" | "MEMORY" | "FROZEN" | "PROTECTED" | "MUTATING" | "UNGATED";

export interface ClassifiedPath {
  readonly path: string;
  readonly relativePath: string;
  readonly pathClass: PathClass;
  readonly context?: string;
}

function normalize(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function stripReposPrefix(path: string): { context?: string; relativePath: string } {
  const normalized = normalize(path);
  const parts = normalized.split("/");
  if (parts[0] === "repos" && parts[1]) {
    return { context: parts[1], relativePath: parts.slice(2).join("/") };
  }
  return { relativePath: normalized };
}

function classifyRelative(relativePath: string): PathClass {
  if (relativePath.startsWith(".dadaia-pi/sessions/") || relativePath.startsWith(".dadaia-pi/states/")) return "PROTECTED";
  if (
    relativePath.startsWith("specs/backlog/") ||
    relativePath.startsWith("specs/bugs/") ||
    relativePath.startsWith("specs/audits/") ||
    relativePath.startsWith(".dadaia-pi/reports/") ||
    relativePath.startsWith(".dadaia-pi/handoff/") ||
    relativePath.startsWith(".dadaia-pi/tmp/")
  ) {
    return "ADDITIVE";
  }
  if (relativePath.startsWith("specs/memory/")) return "MEMORY";
  if (relativePath.startsWith("specs/_archive/")) return "FROZEN";
  if (relativePath.startsWith("specs/releases/")) return "MUTATING";
  if (relativePath.startsWith("specs/")) return "MUTATING";
  return "UNGATED";
}

export function classifyPath(workspaceRoot: string, targetPath: string): ClassifiedPath {
  const cwdRelative = normalize(relative(workspaceRoot, targetPath));
  const safeRelative = cwdRelative === "" || cwdRelative.startsWith("..") ? normalize(targetPath).split(sep).join("/") : cwdRelative;
  const stripped = stripReposPrefix(safeRelative);
  const pathClass = stripped.context && stripped.relativePath.length > 0 ? classifyRelative(stripped.relativePath) : classifyRelative(stripped.relativePath);
  const finalClass = stripped.context && pathClass === "UNGATED" ? "MUTATING" : pathClass;
  return { path: targetPath, relativePath: stripped.relativePath, pathClass: finalClass, ...(stripped.context ? { context: stripped.context } : {}) };
}

export function classifyMany(workspaceRoot: string, paths: readonly string[]): ClassifiedPath[] {
  return paths.map((path) => classifyPath(workspaceRoot, path));
}
