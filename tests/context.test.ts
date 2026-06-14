import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { run } from "../src/cli/main.js";
import { ContextService } from "../src/features/context/service.js";
import { git } from "../src/infrastructure/git/gitClient.js";

async function tmpRoot(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function createRemoteRepo(): Promise<string> {
  const remote = await tmpRoot("dadaia-pi-remote-");
  let result = await git(["init", "--initial-branch", "main"], remote);
  assert.equal(result.code, 0, result.stderr);
  result = await git(["config", "user.email", "test@example.com"], remote);
  assert.equal(result.code, 0, result.stderr);
  result = await git(["config", "user.name", "Test User"], remote);
  assert.equal(result.code, 0, result.stderr);
  await writeFile(join(remote, "README.md"), "# Remote\n", "utf8");
  result = await git(["add", "README.md"], remote);
  assert.equal(result.code, 0, result.stderr);
  result = await git(["commit", "-m", "initial"], remote);
  assert.equal(result.code, 0, result.stderr);
  return remote;
}

describe("context registry and lifecycle", () => {
  it("creates, lists, shows, and updates contexts", async () => {
    const root = await tmpRoot("dadaia-pi-workspace-");
    const service = new ContextService(root);

    const created = await service.create({ name: "demo", repoSlug: "demo-repo", repoUrl: "file:///tmp/demo.git" });
    assert.equal(created.state, "DEAD");
    assert.equal(created.branch, "main");

    const updated = await service.update("demo", { repoUrl: "file:///tmp/updated.git", branch: "develop" });
    assert.equal(updated.repoUrl, "file:///tmp/updated.git");
    assert.equal(updated.branch, "develop");

    assert.equal((await service.list()).length, 1);
    assert.equal((await service.show("demo")).repoSlug, "demo-repo");
  });

  it("clones alive and removes dead", async () => {
    const root = await tmpRoot("dadaia-pi-workspace-");
    const remote = await createRemoteRepo();
    const service = new ContextService(root);
    await service.create({ name: "demo", repoSlug: "demo", repoUrl: remote, branch: "main" });

    const alive = await service.alive("demo");
    assert.equal(alive.state, "ALIVE");
    assert.equal(alive.repoUrl, remote);
    assert.match(await readFile(join(root, "repos", "demo", "README.md"), "utf8"), /Remote/);

    const dead = await service.dead("demo");
    assert.equal(dead.state, "DEAD");
  });

  it("back-fills repoUrl from an existing repository origin", async () => {
    const root = await tmpRoot("dadaia-pi-workspace-");
    const remote = await createRemoteRepo();
    const service = new ContextService(root);
    await service.create({ name: "demo", repoSlug: "demo" });

    await mkdir(join(root, "repos"), { recursive: true });
    const cloneResult = await git(["clone", remote, join(root, "repos", "demo")], root);
    assert.equal(cloneResult.code, 0, cloneResult.stderr);

    const alive = await service.alive("demo");
    assert.equal(alive.repoUrl, remote);
    assert.equal(alive.state, "ALIVE");
  });

  it("exposes context commands through the CLI", async () => {
    const root = await tmpRoot("dadaia-pi-cli-");
    assert.equal(await run(["context", "create", "demo", "--repo", "demo", "--url", "file:///tmp/demo"], root), 0);
    assert.equal(await run(["context", "list"], root), 0);
    assert.equal(await run(["context", "show", "demo"], root), 0);
    assert.equal(await run(["context", "update", "demo", "--branch", "main"], root), 0);
  });
});
