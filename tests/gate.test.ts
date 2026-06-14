import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

import { ContextService } from "../src/features/context/service.js";
import { SessionBindingService } from "../src/features/context/sessionBinding.js";
import { inferBashTargetPaths } from "../src/features/gate/bashTargets.js";
import { classifyPath } from "../src/features/gate/classifier.js";
import { LeaseStore, type ProcessProbe } from "../src/features/gate/lease.js";
import { GatePolicy } from "../src/features/gate/policy.js";

async function tmpRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dadaia-pi-gate-"));
}

describe("gate classifier", () => {
  it("classifies additive, memory, frozen, protected, and repo mutating paths", async () => {
    const root = await tmpRoot();
    assert.equal(classifyPath(root, join(root, "specs", "bugs", "x.md")).pathClass, "ADDITIVE");
    assert.equal(classifyPath(root, join(root, "specs", "memory", "tech-stack.md")).pathClass, "MEMORY");
    assert.equal(classifyPath(root, join(root, "specs", "_archive", "old.md")).pathClass, "FROZEN");
    assert.equal(classifyPath(root, join(root, ".dadaia-pi", "sessions", "x.json")).pathClass, "PROTECTED");
    const repo = classifyPath(root, join(root, "repos", "demo", "src", "index.ts"));
    assert.equal(repo.pathClass, "MUTATING");
    assert.equal(repo.context, "demo");
  });
});

describe("lease kernel", () => {
  it("acquires, renews same session, yields live foreign, and reclaims stale dead", async () => {
    const root = await tmpRoot();
    const liveProbe: ProcessProbe = { isAlive: () => true };
    const store = new LeaseStore(root, liveProbe);

    const acquired = await store.acquire({ context: "demo", release: "v1", sessionId: "s1", mode: "BOUND_IMPLEMENTATION", pid: 111, ttlSeconds: 1 });
    assert.equal(acquired.status, "ACQUIRED");
    const renewed = await store.acquire({ context: "demo", release: "v1", sessionId: "s1", mode: "BOUND_IMPLEMENTATION", pid: 111 });
    assert.equal(renewed.status, "RENEWED");
    const held = await store.acquire({ context: "demo", release: "v1", sessionId: "s2", mode: "BOUND_IMPLEMENTATION", pid: 222 });
    assert.equal(held.status, "HELD");

    const deadProbe: ProcessProbe = { isAlive: () => false };
    const reclaiming = new LeaseStore(root, deadProbe);
    const existing = await reclaiming.read("demo");
    assert(existing);
    const stale = { ...existing, heartbeat: "2000-01-01T00:00:00.000Z", ttlSeconds: 1 };
    assert.equal(reclaiming.isStale(stale), true);
    await mkdir(dirname(reclaiming.lockPath("demo")), { recursive: true });
    await writeFile(reclaiming.lockPath("demo"), `${JSON.stringify(stale, null, 2)}\n`, "utf8");
    const reclaimed = await reclaiming.acquire({ context: "demo", release: "v1", sessionId: "s2", mode: "BOUND_IMPLEMENTATION", pid: 222 });
    assert.equal(reclaimed.status, "RECLAIMED");
  });
});

describe("gate policy", () => {
  it("allows additive writes without a lease", async () => {
    const root = await tmpRoot();
    const decision = await new GatePolicy(root).evaluate({ sessionId: "s1", targetPaths: [join(root, "specs", "bugs", "bug.md")] });
    assert.equal(decision.allow, true);
  });

  it("blocks READ mode mutating writes without acquiring", async () => {
    const root = await tmpRoot();
    await new ContextService(root).create({ name: "demo", repoSlug: "demo" });
    await new SessionBindingService(root).bind({ sessionId: "s1", context: "demo", mode: "read" });
    const decision = await new GatePolicy(root).evaluate({ sessionId: "s1", targetPaths: [join(root, "repos", "demo", "src", "index.ts")] });
    assert.equal(decision.allow, false);
    assert.match(decision.reason, /READ mode/);
    assert.equal(await new LeaseStore(root).read("demo"), undefined);
  });

  it("acquires lease for implementation mutating writes and blocks live foreign holders", async () => {
    const root = await tmpRoot();
    await new ContextService(root).create({ name: "demo", repoSlug: "demo" });
    await new SessionBindingService(root).bind({ sessionId: "s1", context: "demo", mode: "implementation", release: "v1" });
    await new SessionBindingService(root).bind({ sessionId: "s2", context: "demo", mode: "implementation", release: "v1" });
    const probe: ProcessProbe = { isAlive: () => true };
    const first = await new GatePolicy(root, probe).evaluate({ sessionId: "s1", targetPaths: [join(root, "repos", "demo", "src", "index.ts")], pid: 111 });
    assert.equal(first.allow, true);
    const second = await new GatePolicy(root, probe).evaluate({ sessionId: "s2", targetPaths: [join(root, "repos", "demo", "src", "index.ts")], pid: 222 });
    assert.equal(second.allow, false);
    assert.match(second.reason, /held by s1/);
  });

  it("infers mutating bash targets from redirects", async () => {
    const root = await tmpRoot();
    const targets = inferBashTargetPaths(root, "echo hi > repos/demo/src/file.ts");
    assert.deepEqual(targets, [join(root, "repos", "demo", "src", "file.ts")]);
  });
});
