import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import { ContextService } from "../context/service.js";
import { matchesWriteSet, readReservedTaskWriteSet } from "../hooks/taskWriteSet.js";

export interface ControlledPatchOperation {
  readonly path: string;
  readonly content?: string;
  readonly oldText?: string;
  readonly newText?: string;
}

export interface ControlledPatchFile {
  readonly patches?: readonly ControlledPatchOperation[];
  readonly unifiedDiff?: string;
}

const execFileAsync = promisify(execFile);

export interface ControlledPatchResult {
  readonly applied: readonly string[];
  readonly audit: string;
}

function normalize(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function timestamp(): string {
  return new Date().toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function parsePatchFile(value: unknown): { patches: readonly ControlledPatchOperation[]; unifiedDiff?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("patch file must be a JSON object");
  const file = value as ControlledPatchFile;
  if (typeof file.unifiedDiff === "string" && file.unifiedDiff.trim().length > 0) return { patches: [], unifiedDiff: file.unifiedDiff };
  const patches = file.patches;
  if (!Array.isArray(patches) || patches.length === 0) throw new Error("patch file requires non-empty patches[] or unifiedDiff");
  for (const patch of patches) {
    if (typeof patch !== "object" || patch === null || typeof patch.path !== "string") throw new Error("each patch requires path");
    if (patch.content === undefined && (patch.oldText === undefined || patch.newText === undefined)) throw new Error(`patch ${patch.path} requires content or oldText/newText`);
  }
  return { patches };
}

function unifiedDiffPaths(diff: string): string[] {
  const paths = new Set<string>();
  for (const line of diff.split(/\r?\n/)) {
    const git = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (git?.[2] && git[2] !== "/dev/null") paths.add(normalize(git[2]));
    const plus = /^\+\+\+ b\/(.+)$/.exec(line);
    if (plus?.[1] && plus[1] !== "/dev/null") paths.add(normalize(plus[1]));
  }
  return [...paths];
}

export async function applyControlledPatch(workspaceRoot: string, input: { readonly context: string; readonly release: string; readonly patchFile: string; readonly approved: boolean }): Promise<ControlledPatchResult> {
  if (!input.approved) throw new Error("workflow patch apply requires --approve");
  const context = await new ContextService(workspaceRoot).show(input.context);
  const repoRoot = join(workspaceRoot, "repos", context.repoSlug);
  const writeSet = await readReservedTaskWriteSet(repoRoot, input.release);
  if (!writeSet || writeSet.patterns.length === 0) throw new Error("controlled patch requires exactly one reserved task with a non-empty Write set");
  const patchRaw = await readFile(input.patchFile, "utf8");
  const parsed = input.patchFile.endsWith(".diff") || input.patchFile.endsWith(".patch") ? { patches: [], unifiedDiff: patchRaw } : parsePatchFile(JSON.parse(patchRaw));
  const applied: string[] = [];
  if (parsed.unifiedDiff) {
    const paths = unifiedDiffPaths(parsed.unifiedDiff);
    if (paths.length === 0) throw new Error("unified diff does not contain any target paths");
    for (const rel of paths) {
      if (!matchesWriteSet(rel, writeSet.patterns)) throw new Error(`controlled patch path outside reserved task write set: ${rel}`);
    }
    const temp = join(workspaceRoot, ".dadaia-pi", "tmp", `${timestamp()}-controlled.patch`);
    await mkdir(dirname(temp), { recursive: true });
    await writeFile(temp, parsed.unifiedDiff, "utf8");
    await execFileAsync("git", ["-C", repoRoot, "apply", "--whitespace=nowarn", temp], { maxBuffer: 10 * 1024 * 1024 });
    applied.push(...paths);
  }
  for (const patch of parsed.patches) {
    const rel = normalize(patch.path);
    if (!matchesWriteSet(rel, writeSet.patterns)) throw new Error(`controlled patch path outside reserved task write set: ${rel}`);
    const abs = join(repoRoot, rel);
    await mkdir(dirname(abs), { recursive: true });
    if (patch.content !== undefined) {
      await writeFile(abs, patch.content, "utf8");
    } else {
      const current = await readFile(abs, "utf8");
      const oldText = patch.oldText ?? "";
      if (!current.includes(oldText)) throw new Error(`controlled patch oldText not found in ${rel}`);
      await writeFile(abs, current.replace(oldText, patch.newText ?? ""), "utf8");
    }
    applied.push(rel);
  }
  const auditDir = join(workspaceRoot, ".dadaia-pi", "reports", context.name, "patches");
  await mkdir(auditDir, { recursive: true });
  const auditPath = join(auditDir, `${timestamp()}-controlled-patch.json`);
  const audit = {
    schemaVersion: 1,
    context: context.name,
    release: input.release,
    task: writeSet.taskLine,
    writeSet: writeSet.patterns,
    patchFile: relative(workspaceRoot, input.patchFile),
    applied,
    appliedAt: new Date().toISOString(),
  };
  await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  return { applied, audit: relative(workspaceRoot, auditPath).replaceAll("\\", "/") };
}
