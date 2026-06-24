import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { run } from "../src/cli/main.js";
import { ContextService } from "../src/features/context/service.js";
import { installAllHooks, preCommitCheck, prePushCheck, uninstallAllHooks } from "../src/features/hooks/index.js";
import { LeaseStore } from "../src/features/gate/lease.js";
import { git } from "../src/infrastructure/git/gitClient.js";

async function tmpRoot(prefix = "dadaia-pi-hooks-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function initGitRepo(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
  let result = await git(["init", "--initial-branch", "main"], path);
  assert.equal(result.code, 0, result.stderr);
  result = await git(["config", "user.email", "test@example.com"], path);
  assert.equal(result.code, 0, result.stderr);
  result = await git(["config", "user.name", "Test User"], path);
  assert.equal(result.code, 0, result.stderr);
}

async function createWorkspaceContext(): Promise<{ workspaceRoot: string; repoRoot: string }> {
  const workspaceRoot = await tmpRoot();
  const repoRoot = join(workspaceRoot, "repos", "demo");
  await initGitRepo(repoRoot);
  await new ContextService(workspaceRoot).create({ name: "demo", repoSlug: "demo" });
  await mkdir(join(repoRoot, "specs", "releases", "v1"), { recursive: true });
  await mkdir(join(repoRoot, "src"), { recursive: true });
  await writeFile(join(repoRoot, "specs", "releases", "ACTIVE.md"), "---\nrelease: v1\nphase: IMPLEMENTATION\n---\n", "utf8");
  await writeFile(join(repoRoot, "specs", "releases", "v1", "TASKS.md"), "# TASKS\n\n**Status:** Aprovado\n\n- [-] T-001 Implement\n  - Write set: `src/index.ts`, `specs/releases/**`\n", "utf8");
  await mkdir(join(workspaceRoot, ".dadaia-pi", "workflows", "demo"), { recursive: true });
  await writeFile(
    join(workspaceRoot, ".dadaia-pi", "workflows", "demo", "implementation.json"),
    JSON.stringify({ context: "demo", release: "v1", workflowId: "release-implementation", sdk: { accepted: true }, verdict: { value: "APPROVED", blockingFindings: 0 }, orchestration: { engine: "python" } }),
    "utf8",
  );
  await writeFile(join(repoRoot, "src", "index.ts"), "export const x = 1;\n", "utf8");
  const add = await git(["add", "src/index.ts", "specs/releases/ACTIVE.md", "specs/releases/v1/TASKS.md"], repoRoot);
  assert.equal(add.code, 0, add.stderr);
  return { workspaceRoot, repoRoot };
}

describe("git chokepoints", () => {
  it("installs and uninstalls pre-commit/pre-push hooks", async () => {
    const repoRoot = await tmpRoot();
    await initGitRepo(repoRoot);
    const paths = await installAllHooks(repoRoot);
    assert.equal(paths.length, 2);
    const preCommit = await readFile(join(repoRoot, ".git", "hooks", "pre-commit"), "utf8");
    assert.match(preCommit, /dadaia-pi hooks pre-commit-check/);
    await chmod(join(repoRoot, ".git", "hooks", "pre-commit"), 0o755);
    await uninstallAllHooks(repoRoot);
  });

  it("exposes hook install and pre-commit check through the CLI", async () => {
    const repoRoot = await tmpRoot();
    await initGitRepo(repoRoot);
    assert.equal(await run(["hooks", "install", "--repo-root", repoRoot], repoRoot), 0);
    assert.match(await readFile(join(repoRoot, ".git", "hooks", "pre-push"), "utf8"), /dadaia-pi hooks pre-push-check/);
    assert.equal(await run(["hooks", "pre-commit-check", "--repo-root", repoRoot], repoRoot), 0);
    assert.equal(await run(["hooks", "uninstall", "--repo-root", repoRoot], repoRoot), 0);
  });

  it("blocks mutating commits without a matching session lease", async () => {
    const { workspaceRoot, repoRoot } = await createWorkspaceContext();
    const result = await preCommitCheck(workspaceRoot, repoRoot, undefined);
    assert.equal(result.ok, false);
    assert.match(result.messages.join("\n"), /DADAIA_PI_SESSION_ID/);
  });

  it("allows mutating commits with matching lease and reserved task write set", async () => {
    const { workspaceRoot, repoRoot } = await createWorkspaceContext();
    await new LeaseStore(workspaceRoot).acquire({ context: "demo", release: "v1", sessionId: "s1", mode: "BOUND_IMPLEMENTATION" });
    const result = await preCommitCheck(workspaceRoot, repoRoot, "s1");
    assert.equal(result.ok, true, result.messages.join("\n"));
  });

  it("blocks mutating commits outside the reserved task write set", async () => {
    const { workspaceRoot, repoRoot } = await createWorkspaceContext();
    await writeFile(join(repoRoot, "src", "other.ts"), "export const y = 2;\n", "utf8");
    const add = await git(["add", "src/other.ts"], repoRoot);
    assert.equal(add.code, 0, add.stderr);
    await new LeaseStore(workspaceRoot).acquire({ context: "demo", release: "v1", sessionId: "s1", mode: "BOUND_IMPLEMENTATION" });
    const result = await preCommitCheck(workspaceRoot, repoRoot, "s1");
    assert.equal(result.ok, false);
    assert.match(result.messages.join("\n"), /outside reserved task write set/);
  });

  it("blocks pushed commits without approved security handoff", async () => {
    const workspaceRoot = await tmpRoot();
    const stdin = "refs/heads/main abcdef1234567890 refs/heads/main 0000000000000000\n";
    const result = await prePushCheck(workspaceRoot, stdin);
    assert.equal(result.ok, false);
    assert.match(result.messages.join("\n"), /outside any APPROVED security-review RC/);
  });

  it("allows pushed commits with approved security workflow evidence tied to a matching RC range", async () => {
    const workspaceRoot = await tmpRoot();
    await initGitRepo(workspaceRoot);
    await writeFile(join(workspaceRoot, "README.md"), "base\n", "utf8");
    await git(["add", "README.md"], workspaceRoot);
    await git(["commit", "-m", "base"], workspaceRoot);
    const base = (await git(["rev-parse", "HEAD"], workspaceRoot)).stdout.trim();
    await writeFile(join(workspaceRoot, "README.md"), "head\n", "utf8");
    await git(["add", "README.md"], workspaceRoot);
    await git(["commit", "-m", "head"], workspaceRoot);
    const head = (await git(["rev-parse", "HEAD"], workspaceRoot)).stdout.trim();
    await mkdir(join(workspaceRoot, ".dadaia-pi", "workflows", "demo"), { recursive: true });
    await mkdir(join(workspaceRoot, ".dadaia-pi", "release-candidates", "demo", "v1"), { recursive: true });
    await writeFile(
      join(workspaceRoot, ".dadaia-pi", "release-candidates", "demo", "v1", "rc-1.json"),
      JSON.stringify({ schemaVersion: 1, id: "rc-1", context: "demo", release: "v1", commitRange: `${base}..${head}`, createdAt: new Date().toISOString(), reviews: { qa: [], security: [], code: [] } }),
      "utf8",
    );
    await writeFile(
      join(workspaceRoot, ".dadaia-pi", "workflows", "demo", "security.json"),
      JSON.stringify({ context: "demo", release: "v1", workflowId: "security-review", sdk: { accepted: true }, verdict: { value: "APPROVED", blockingFindings: 0 }, releaseCandidate: { id: "rc-1" } }),
      "utf8",
    );
    const stdin = `refs/heads/main ${head} refs/heads/main 0000000000000000\n`;
    const result = await prePushCheck(workspaceRoot, stdin);
    assert.equal(result.ok, true, result.messages.join("\n"));
  });

  it("allows pushed commits with approved security handoff", async () => {
    const workspaceRoot = await tmpRoot();
    await mkdir(join(workspaceRoot, ".dadaia-pi", "handoff", "demo"), { recursive: true });
    await writeFile(
      join(workspaceRoot, ".dadaia-pi", "handoff", "demo", "security.json"),
      JSON.stringify({ agent: "security-reviewer", verdict: "APPROVED", metrics: { commit_sha: "abcdef1234567890" } }),
      "utf8",
    );
    const stdin = "refs/heads/main abcdef1234567890 refs/heads/main 0000000000000000\n";
    const result = await prePushCheck(workspaceRoot, stdin);
    assert.equal(result.ok, true, result.messages.join("\n"));
  });
});
