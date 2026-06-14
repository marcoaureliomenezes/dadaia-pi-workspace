import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import type { DoctorIssue, DoctorReport } from "../../core/issues.js";
import { summarizeIssues } from "../../core/issues.js";
import { validateCatalog } from "../memory/catalog.js";

const APPROVED_TOKEN = "**Status:** Aprovado";
const TASK_MARKERS = ["[ ]", "[-]", "[x]"] as const;

type ActiveRelease = {
  readonly release?: string;
  readonly phase?: string;
};

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function issue(code: string, severity: "error" | "warning", path: string, message: string): DoctorIssue {
  return { code, severity, path, message };
}

function parseSimpleFrontmatter(text: string): Record<string, string> {
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---", 4);
  if (end < 0) return {};
  const block = text.slice(4, end);
  const result: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    const raw = line.slice(index + 1).trim();
    result[key] = raw.replace(/^['\"]|['\"]$/g, "");
  }
  return result;
}

async function readActive(specsDir: string, issues: DoctorIssue[]): Promise<ActiveRelease> {
  const path = join(specsDir, "releases", "ACTIVE.md");
  if (!(await exists(path))) {
    issues.push(issue("SPEC-DOC-003", "error", "releases/ACTIVE.md", "ACTIVE.md is missing"));
    return {};
  }
  const fields = parseSimpleFrontmatter(await readFile(path, "utf8"));
  if (!fields.release) issues.push(issue("SPEC-DOC-003", "error", "releases/ACTIVE.md", "ACTIVE.md is missing release"));
  if (!fields.phase) issues.push(issue("SPEC-DOC-003", "error", "releases/ACTIVE.md", "ACTIVE.md is missing phase"));
  const active: { release?: string; phase?: string } = {};
  if (fields.release) active.release = fields.release;
  if (fields.phase) active.phase = fields.phase;
  return active;
}

async function checkRequiredFiles(specsDir: string): Promise<DoctorIssue[]> {
  const required = [
    "constitution.md",
    "AGENTS.md",
    "memory/AGENTS.md",
    "memory/architecture.md",
    "memory/tech-stack.md",
    "memory/quality-assurance.md",
    "memory/product/index.md",
    "memory/product/catalog.json",
    "releases/ACTIVE.md",
  ];
  const issues: DoctorIssue[] = [];
  for (const relative of required) {
    if (!(await exists(join(specsDir, relative)))) {
      issues.push(issue("TREE-REQUIRED", relative.includes("AGENTS.md") ? "warning" : "error", relative, "Required specs file is missing"));
    }
  }
  for (const dir of ["backlog", "bugs", "releases", "audits", "memory/product"]) {
    if (!(await exists(join(specsDir, dir)))) issues.push(issue("TREE-DIR", "error", dir, "Required specs directory is missing"));
  }
  return issues;
}

async function checkCatalog(specsDir: string): Promise<DoctorIssue[]> {
  try {
    const result = await validateCatalog(specsDir);
    const issues: DoctorIssue[] = [];
    for (const slug of result.missingFromCatalog) {
      issues.push(issue("CAT-1", "warning", "memory/product/catalog.json", `Product atom '${slug}' is missing from catalog`));
    }
    for (const slug of result.staleInCatalog) {
      issues.push(issue("CAT-1", "warning", "memory/product/catalog.json", `Catalog references missing product atom '${slug}'`));
    }
    return issues;
  } catch (error) {
    return [issue("CAT-1", "error", "memory/product/catalog.json", `Cannot validate catalog: ${(error as Error).message}`)];
  }
}

async function checkActiveRelease(specsDir: string, active: ActiveRelease): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = [];
  if (!active.release) return issues;
  const releaseDir = join(specsDir, "releases", active.release);
  if (!(await exists(releaseDir))) {
    issues.push(issue("SPEC-DOC-004", "error", `releases/${active.release}`, "Active release directory is missing"));
    return issues;
  }
  for (const file of ["SPEC.md", "PLAN.md", "TASKS.md"]) {
    const path = join(releaseDir, file);
    const relative = `releases/${active.release}/${file}`;
    if (!(await exists(path))) {
      issues.push(issue("SPEC-DOC-004", "error", relative, "Active release artifact is missing"));
      continue;
    }
    const text = await readFile(path, "utf8");
    if (!text.includes(APPROVED_TOKEN)) {
      issues.push(issue("SPEC-DOC-005", "error", relative, `Active release artifact lacks ${APPROVED_TOKEN}`));
    }
  }
  const tasksPath = join(releaseDir, "TASKS.md");
  if (await exists(tasksPath)) {
    const tasks = await readFile(tasksPath, "utf8");
    const taskLines = tasks.split(/\r?\n/).filter((line) => /^- \[[ x-]\] /.test(line));
    for (const line of taskLines) {
      if (!TASK_MARKERS.some((marker) => line.startsWith(`- ${marker} `))) {
        issues.push(issue("SPEC-DOC-024", "error", `releases/${active.release}/TASKS.md`, `Invalid task marker: ${line}`));
      }
    }
    if (active.phase === "IMPLEMENTATION" && !taskLines.some((line) => line.startsWith("- [-] ") || line.startsWith("- [x] "))) {
      issues.push(issue("SPEC-DOC-024", "warning", `releases/${active.release}/TASKS.md`, "IMPLEMENTATION phase has no in-progress or completed task"));
    }
  }
  return issues;
}

async function checkDuplicateReleaseIds(specsDir: string): Promise<DoctorIssue[]> {
  const releasesDir = join(specsDir, "releases");
  if (!(await exists(releasesDir))) return [];
  const entries = await readdir(releasesDir, { withFileTypes: true });
  const seen = new Set<string>();
  const issues: DoctorIssue[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (seen.has(entry.name)) issues.push(issue("SPEC-DOC-026", "error", `releases/${entry.name}`, "Duplicate release id"));
    seen.add(entry.name);
  }
  return issues;
}

async function checkAuditNaming(specsDir: string): Promise<DoctorIssue[]> {
  const auditsDir = join(specsDir, "audits");
  if (!(await exists(auditsDir))) return [];
  const entries = await readdir(auditsDir, { withFileTypes: true });
  const issues: DoctorIssue[] = [];
  const auditPattern = /^\d{8}T\d{6}Z-[a-zA-Z0-9]{8}$/;
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== "_archive" && !auditPattern.test(entry.name)) {
      issues.push(issue("SPEC-DOC-030", "warning", `audits/${entry.name}`, "Audit directory should use <YYYYMMDDTHHMMSSZ>-<session_id_8> naming"));
    }
  }
  return issues;
}

export async function runSpecsDoctor(specsDir: string): Promise<DoctorReport> {
  const issues: DoctorIssue[] = [];
  issues.push(...(await checkRequiredFiles(specsDir)));
  const active = await readActive(specsDir, issues);
  issues.push(...(await checkCatalog(specsDir)));
  issues.push(...(await checkActiveRelease(specsDir, active)));
  issues.push(...(await checkDuplicateReleaseIds(specsDir)));
  issues.push(...(await checkAuditNaming(specsDir)));
  return { root: specsDir, issues, summary: summarizeIssues(issues) };
}
