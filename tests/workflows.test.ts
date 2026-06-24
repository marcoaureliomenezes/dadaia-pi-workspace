import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { run } from "../src/cli/main.js";
import { ContextService } from "../src/features/context/service.js";
import type { WorkflowSdkAdapter } from "../src/features/workflows/index.js";
import {
  advanceWorkflowPhase,
  applyControlledPatch,
  checkBacklogHygiene,
  commitRangeFromEndpoints,
  consumeBacklogItem,
  createReleaseCandidate,
  getWorkflowDefinition,
  inspectReleaseCandidate,
  listReleaseCandidates,
  listWorkflowDefinitions,
  runWorkflow,
  workflowGovernanceStatus,
} from "../src/features/workflows/index.js";
import { git } from "../src/infrastructure/git/gitClient.js";

async function tempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dadaia-pi-workflows-"));
}

async function initGitRepo(path: string): Promise<void> {
  await git(["init", "--initial-branch", "main"], path);
  await git(["config", "user.email", "test@example.com"], path);
  await git(["config", "user.name", "Test User"], path);
}

async function setupContext(root: string): Promise<void> {
  const service = new ContextService(root);
  await service.create({ name: "demo", repoSlug: "demo" });
  await mkdir(join(root, "repos", "demo"), { recursive: true });
  await service.alive("demo");
  const releaseDir = join(root, "repos", "demo", "specs", "releases", "v1");
  await mkdir(releaseDir, { recursive: true });
  await writeFile(join(releaseDir, "SPEC.md"), "# SPEC\n\n**Status:** Aprovado\n", "utf8");
  await writeFile(join(releaseDir, "PLAN.md"), "# PLAN\n\n**Status:** Aprovado\n", "utf8");
  await mkdir(join(root, "repos", "demo", "specs", "backlog"), { recursive: true });
  await writeFile(join(root, "repos", "demo", "specs", "backlog", "existing.md"), "# Existing\n\nAdd workflow governance for backlog release hygiene conflicts.\n", "utf8");
  await writeFile(join(root, "repos", "demo", "specs", "releases", "ACTIVE.md"), "---\nrelease: v1\nphase: BACKLOG\n---\n", "utf8");
  await writeFile(join(releaseDir, "TASKS.md"), "# TASKS\n\n**Status:** Aprovado\n\n- [ ] T-1\n  - Write set: `src/**`, `README.md`\n", "utf8");
}

describe("workflow orchestration", () => {
  it("defines the full lifecycle workflow catalog", () => {
    const ids = listWorkflowDefinitions().map((item) => item.id);
    assert.deepEqual(ids, [
      "backlog-definition",
      "release-definition",
      "release-implementation",
      "architecture-review",
      "push-gate",
      "backlog-intake",
      "research",
      "release-define",
      "spec-review",
      "implementation-task",
      "qa-review",
      "security-review",
      "code-review",
      "release-closure",
    ]);
    assert.equal(getWorkflowDefinition("spec-review").sdkStep.name, "bounded-spec-reviewer");
    assert.equal(getWorkflowDefinition("release-implementation").orchestration?.engine, "python");
    assert.match(getWorkflowDefinition("release-implementation").orchestration?.steps.map((step) => step.title).join("\n") ?? "", /Create tests first/);
  });

  it("runs a dry-run workflow and emits context-scoped manifest/report evidence", async () => {
    const root = await tempRoot();
    await setupContext(root);
    const prompt = join(root, "prompt.md");
    await writeFile(prompt, "Review release v1 strictly.", "utf8");

    const result = await runWorkflow(root, { workflowId: "spec-review", context: "demo", release: "v1", promptFile: prompt, dryRun: true });
    assert.equal(result.manifest.context, "demo");
    assert.equal(result.manifest.release, "v1");
    assert.equal(result.manifest.sdk.mode, "fallback");
    assert.equal(result.manifest.verdict.value, "APPROVED");
    assert.equal(result.manifest.verdict.blockingFindings, 0);
    assert.deepEqual(result.manifest.verdict.findings, []);
    assert.equal(result.manifest.verdict.risk, "low");
    assert.equal(result.manifest.linkedHandoffs.length, 1);
    assert.match(result.reportText, /Workflow report - spec-review/);

    await stat(join(root, result.manifest.linkedHandoffs[0] ?? "missing"));
    await stat(join(root, result.manifest.artifacts.manifest));
    const report = await readFile(join(root, result.manifest.artifacts.report), "utf8");
    assert.match(report, /Review release v1 strictly/);
  });

  it("runs the Python-backed release implementation workflow", async () => {
    const root = await tempRoot();
    await setupContext(root);

    const result = await runWorkflow(root, { workflowId: "release-implementation", context: "demo", release: "v1", dryRun: true });
    assert.equal(result.manifest.sdk.mode, "python");
    assert.equal(result.manifest.verdict.value, "APPROVED");
    assert.equal(result.manifest.orchestration?.engine, "python");
    assert.ok((result.manifest.orchestration?.executions?.length ?? 0) > 0);
    assert.ok(result.manifest.orchestration?.executions?.some((step) => step.id === "write-tests" && step.model === "qa"));
    assert.match(result.manifest.sdk.summary, /TDD is mandatory/);
    assert.match(result.reportText, /Create tests first/);
    assert.match(result.reportText, /Step executions/);
  });

  it("enforces workflow phase gates using accepted manifests", async () => {
    const root = await tempRoot();
    await setupContext(root);

    let status = await workflowGovernanceStatus(root, "demo", "v1");
    assert.deepEqual(status.allowedNext, ["RESEARCH", "RELEASE_DEFINITION"]);
    assert.equal(status.canAdvance, true);

    status = await advanceWorkflowPhase(root, "demo", "v1", "RELEASE_DEFINITION");
    assert.equal(status.phase, "RELEASE_DEFINITION");
    status = await advanceWorkflowPhase(root, "demo", "v1", "SPEC_REVIEW");
    assert.equal(status.phase, "SPEC_REVIEW");

    await assert.rejects(() => advanceWorkflowPhase(root, "demo", "v1", "IMPLEMENTATION"), /missing APPROVED spec-review/);
    await mkdir(join(root, ".dadaia-pi", "workflows", "demo"), { recursive: true });
    await writeFile(
      join(root, ".dadaia-pi", "workflows", "demo", "spec-review-blocked.json"),
      JSON.stringify({ schemaVersion: 1, runId: "r0", workflowId: "spec-review", title: "Spec", phase: "SPEC_REVIEW", activity: "ADDITIVE", context: "demo", repoSlug: "demo", release: "v1", dryRun: true, sdk: { mode: "fallback", accepted: true, summary: "ok" }, verdict: { value: "APPROVED", source: "cli", blockingFindings: 1 }, linkedHandoffs: [], checks: { preflight: [], postflight: [] }, artifacts: { manifest: "m", report: "r" }, createdAt: "2026-06-18T00:00:00Z" }),
      "utf8",
    );
    await assert.rejects(() => advanceWorkflowPhase(root, "demo", "v1", "IMPLEMENTATION"), /missing APPROVED spec-review/);
    await writeFile(
      join(root, ".dadaia-pi", "workflows", "demo", "spec-review.json"),
      JSON.stringify({ schemaVersion: 1, runId: "r1", workflowId: "spec-review", title: "Spec", phase: "SPEC_REVIEW", activity: "ADDITIVE", context: "demo", repoSlug: "demo", release: "v1", dryRun: true, sdk: { mode: "fallback", accepted: true, summary: "ok" }, verdict: { value: "APPROVED", source: "cli" }, linkedHandoffs: [], checks: { preflight: [], postflight: [] }, artifacts: { manifest: "m", report: "r" }, createdAt: "2026-06-18T00:00:00Z" }),
      "utf8",
    );
    status = await advanceWorkflowPhase(root, "demo", "v1", "IMPLEMENTATION");
    assert.equal(status.phase, "IMPLEMENTATION");
  });

  it("checks backlog conflicts and marks backlog consumed", async () => {
    const root = await tempRoot();
    await setupContext(root);
    const demand = join(root, "demand.md");
    await writeFile(demand, "Need workflow governance for backlog release hygiene conflicts.", "utf8");
    const check = await checkBacklogHygiene(root, "demo", demand);
    assert.equal(check.conflicts.length, 1);
    const consumed = await consumeBacklogItem(root, "demo", "v1", "specs/backlog/existing.md");
    assert.equal(consumed.path, "specs/backlog/existing.md");
    const text = await readFile(join(root, "repos", "demo", "specs", "backlog", "existing.md"), "utf8");
    assert.match(text, /consumed_by_release: v1/);
  });

  it("creates release candidates and maps workflow reviews to RC ids", async () => {
    const root = await tempRoot();
    await setupContext(root);
    const rc = await createReleaseCandidate(root, "demo", "v1", "rc-1", "abc..def");
    assert.equal(rc.id, "rc-1");
    assert.equal((await listReleaseCandidates(root, "demo", "v1")).length, 1);
    const result = await runWorkflow(root, { workflowId: "qa-review", context: "demo", release: "v1", rcId: "rc-1", dryRun: true });
    assert.equal(result.manifest.releaseCandidate?.id, "rc-1");
    assert.deepEqual(result.manifest.verdict.reviewedPaths, []);
    assert.deepEqual(result.manifest.verdict.acceptanceCoverage, ["<release-acceptance>"]);
    const [updated] = await listReleaseCandidates(root, "demo", "v1");
    assert.equal(updated?.reviews.qa.length, 1);
  });

  it("parses rich verdict JSON from SDK summaries", async () => {
    const root = await tempRoot();
    await setupContext(root);
    const adapter: WorkflowSdkAdapter = {
      async runStep() {
        return { mode: "sdk", accepted: true, summary: '```json\n{"verdict":"APPROVED","risk":"medium","blockingFindings":0,"findings":["note"],"reviewedPaths":["src/foo.ts"],"acceptanceCoverage":["AC-1"]}\n```' };
      },
    };
    const result = await runWorkflow(root, { workflowId: "code-review", context: "demo", release: "v1", dryRun: false }, adapter);
    assert.equal(result.manifest.verdict.value, "APPROVED");
    assert.equal(result.manifest.verdict.risk, "medium");
    assert.deepEqual(result.manifest.verdict.findings, ["note"]);
    assert.deepEqual(result.manifest.verdict.reviewedPaths, ["src/foo.ts"]);
    assert.deepEqual(result.manifest.verdict.acceptanceCoverage, ["AC-1"]);
  });

  it("creates RCs from endpoints, inspects them, and applies controlled patches", async () => {
    const root = await tempRoot();
    await setupContext(root);
    const repo = join(root, "repos", "demo");
    await initGitRepo(repo);
    await writeFile(join(repo, "base.txt"), "base\n", "utf8");
    await git(["add", "base.txt"], repo);
    await git(["commit", "-m", "base"], repo);
    const base = (await git(["rev-parse", "HEAD"], repo)).stdout.trim();
    await writeFile(join(repo, "base.txt"), "head\n", "utf8");
    await git(["add", "base.txt"], repo);
    await git(["commit", "-m", "head"], repo);
    const head = (await git(["rev-parse", "HEAD"], repo)).stdout.trim();
    await createReleaseCandidate(root, "demo", "v1", "rc-2", commitRangeFromEndpoints(base, head));
    const inspected = await inspectReleaseCandidate(root, "demo", "v1", "rc-2");
    assert.equal(inspected.commits.length, 1);
    assert.equal(inspected.stale, false);

    await mkdir(join(repo, "src"), { recursive: true });
    await writeFile(join(repo, "specs", "releases", "v1", "TASKS.md"), "# TASKS\n\n**Status:** Aprovado\n\n- [-] T-1\n  - Write set: `src/**`\n", "utf8");
    const patchFile = join(root, "patch.json");
    await writeFile(patchFile, JSON.stringify({ patches: [{ path: "src/new.ts", content: "export const x = 1;\n" }] }), "utf8");
    const applied = await applyControlledPatch(root, { context: "demo", release: "v1", patchFile, approved: true });
    assert.deepEqual(applied.applied, ["src/new.ts"]);
    assert.match(await readFile(join(repo, "src", "new.ts"), "utf8"), /x = 1/);
    const diffFile = join(root, "patch-diff.json");
    await writeFile(diffFile, JSON.stringify({ unifiedDiff: "diff --git a/src/new.ts b/src/new.ts\n--- a/src/new.ts\n+++ b/src/new.ts\n@@ -1 +1 @@\n-export const x = 1;\n+export const x = 2;\n" }), "utf8");
    const diffApplied = await applyControlledPatch(root, { context: "demo", release: "v1", patchFile: diffFile, approved: true });
    assert.deepEqual(diffApplied.applied, ["src/new.ts"]);
    assert.match(await readFile(join(repo, "src", "new.ts"), "utf8"), /x = 2/);
  });

  it("exposes workflow commands through the CLI", async () => {
    const root = await tempRoot();
    await setupContext(root);
    assert.equal(await run(["workflow", "list", "--json"], root), 0);
    assert.equal(await run(["workflow", "show", "backlog-intake", "--json"], root), 0);
    assert.equal(await run(["workflow", "status", "--context", "demo", "--release", "v1", "--json"], root), 0);
    assert.equal(await run(["workflow", "advance", "--context", "demo", "--release", "v1", "--to", "RELEASE_DEFINITION", "--json"], root), 0);
    assert.equal(await run(["workflow", "run", "spec-review", "--context", "demo", "--release", "v1", "--dry-run", "--json"], root), 0);
  });
});
