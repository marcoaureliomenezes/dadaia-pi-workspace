import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { run } from "../src/cli/main.js";
import { ContextService } from "../src/features/context/service.js";
import { SessionBindingService } from "../src/features/context/sessionBinding.js";
import { buildWorkspaceStatus } from "../src/features/status/statusService.js";

async function tempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dadaia-pi-status-"));
}

async function writeRelease(root: string): Promise<void> {
  const releaseDir = join(root, "repos", "demo", "specs", "releases", "v1");
  await mkdir(releaseDir, { recursive: true });
  await writeFile(join(root, "repos", "demo", "specs", "releases", "ACTIVE.md"), "---\nrelease: v1\nphase: IMPLEMENTATION\n---\n", "utf8");
  await writeFile(join(releaseDir, "SPEC.md"), "---\nstatus: Aprovado\n---\n\n# SPEC\n\n**Status:** Aprovado\n", "utf8");
  await writeFile(join(releaseDir, "PLAN.md"), "---\nstatus: Aprovado\n---\n\n# PLAN\n\n**Status:** Aprovado\n", "utf8");
  await writeFile(join(releaseDir, "TASKS.md"), "---\nstatus: Aprovado\n---\n\n# TASKS\n\n**Status:** Aprovado\n\n- [ ] T-1 Open\n- [-] T-2 Active\n- [x] T-3 Done\n", "utf8");
}

describe("workspace status", () => {
  it("summarizes an uninitialized workspace without failing", async () => {
    const root = await tempRoot();
    const report = await buildWorkspaceStatus(root);
    assert.equal(report.root, root);
    assert.equal(report.doctor.warnings, 1);
    assert.deepEqual(report.contexts, []);
  });

  it("summarizes contexts, binding, release tasks, and evidence", async () => {
    const root = await tempRoot();
    await new ContextService(root).create({ name: "demo", repoSlug: "demo" });
    await mkdir(join(root, "repos", "demo"), { recursive: true });
    await writeRelease(root);
    await new SessionBindingService(root).bind({ sessionId: "s1", context: "demo", mode: "implementation", release: "v1" });
    await mkdir(join(root, ".dadaia-pi", "handoff", "demo"), { recursive: true });
    await writeFile(join(root, ".dadaia-pi", "handoff", "demo", "x.handoff.json"), JSON.stringify({ schemaVersion: 1, context: "demo", sessionId: "s1", agent: "a", producedAt: "2026-06-14T20:00:00Z", scope: "s", artifact: { type: "handoff" }, metrics: {}, findings: [] }), "utf8");
    await mkdir(join(root, ".dadaia-pi", "reports", "demo", "qa"), { recursive: true });
    await writeFile(join(root, ".dadaia-pi", "reports", "demo", "qa", "r.md"), "report", "utf8");

    const report = await buildWorkspaceStatus(root, { sessionId: "s1" });
    assert.equal(report.binding?.context, "demo");
    assert.equal(report.selectedContext, "demo");
    const context = report.contexts[0];
    assert(context);
    assert.equal(context.selected, true);
    assert.equal(context.release?.release, "v1");
    assert.equal(context.release?.phase, "IMPLEMENTATION");
    assert.deepEqual(context.release?.tasks, { open: 1, inProgress: 1, done: 1 });
    assert.deepEqual(context.evidence, { handoffs: 1, reports: 1 });
  });

  it("exposes status through the CLI", async () => {
    const root = await tempRoot();
    await new ContextService(root).create({ name: "demo", repoSlug: "demo" });
    assert.equal(await run(["status", "--context", "demo", "--json"], root), 0);
    assert.equal(await run(["status", "--context", "demo"], root), 0);
  });
});
