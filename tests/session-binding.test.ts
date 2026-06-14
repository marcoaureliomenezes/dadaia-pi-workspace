import assert from "node:assert/strict";
import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { run } from "../src/cli/main.js";
import { ContextService } from "../src/features/context/service.js";
import { bindEpochPath, contextPointerPath, sessionPointerPath, sessionRecordPath } from "../src/features/context/sessionPaths.js";
import { scaffoldSpecs } from "../src/features/specs/scaffold.js";
import { SessionBindingService } from "../src/features/context/sessionBinding.js";

async function tmpRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dadaia-pi-session-"));
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("session bind and memory injection", () => {
  it("binds a Pi session id to context metadata, markers, and pointers", async () => {
    const root = await tmpRoot();
    await new ContextService(root).create({ name: "demo", repoSlug: "demo" });

    const record = await new SessionBindingService(root).bind({ sessionId: "pi-session-1", context: "demo", mode: "read" });
    assert.equal(record.sessionId, "pi-session-1");
    assert.equal(record.context, "demo");
    assert.equal(record.mode, "READ");

    assert.equal(JSON.parse(await readFile(sessionRecordPath(root, "pi-session-1"), "utf8")).context, "demo");
    assert.equal((await readFile(contextPointerPath(root, "demo"), "utf8")).trim(), "pi-session-1");
    assert.equal((await readFile(sessionPointerPath(root, "pi-session-1"), "utf8")).trim(), "demo");
    assert.equal(await exists(bindEpochPath(root, "demo")), true);
  });

  it("requires release for implementation/review modes", async () => {
    const root = await tmpRoot();
    await new ContextService(root).create({ name: "demo", repoSlug: "demo" });
    await assert.rejects(
      () => new SessionBindingService(root).bind({ sessionId: "pi-session-1", context: "demo", mode: "implementation" }),
      /requires --release/,
    );
    const record = await new SessionBindingService(root).bind({
      sessionId: "pi-session-1",
      context: "demo",
      mode: "implementation",
      release: "v0.1.0",
    });
    assert.equal(record.mode, "BOUND_IMPLEMENTATION");
    assert.equal(record.release, "v0.1.0");
  });

  it("releases session records and matching pointers", async () => {
    const root = await tmpRoot();
    await new ContextService(root).create({ name: "demo", repoSlug: "demo" });
    const service = new SessionBindingService(root);
    await service.bind({ sessionId: "pi-session-1", context: "demo" });
    await service.release("pi-session-1");
    assert.equal(await exists(sessionRecordPath(root, "pi-session-1")), false);
    assert.equal(await exists(sessionPointerPath(root, "pi-session-1")), false);
    assert.equal(await exists(contextPointerPath(root, "demo")), false);
  });

  it("builds memory bootstrap from specs", async () => {
    const root = await tmpRoot();
    await scaffoldSpecs(join(root, "specs"));
    await new ContextService(root).create({ name: "demo", repoSlug: "demo" });
    const service = new SessionBindingService(root);
    await service.bind({ sessionId: "pi-session-1", context: "demo" });
    const bootstrap = await service.memoryBootstrap("pi-session-1");
    assert.equal(bootstrap.context, "demo");
    assert.match(bootstrap.content, /constitution\.md/);
    assert.match(bootstrap.content, /memory\/tech-stack\.md/);
    assert.match(bootstrap.content, /memory\/product\/catalog\.json/);
  });

  it("exposes bind, status, and release through CLI fallback commands", async () => {
    const root = await tmpRoot();
    await new ContextService(root).create({ name: "demo", repoSlug: "demo" });
    assert.equal(await run(["context", "bind", "demo", "--session-id", "pi-session-1"], root), 0);
    assert.equal(await run(["context", "status", "--session-id", "pi-session-1"], root), 0);
    assert.equal(await run(["context", "release", "--session-id", "pi-session-1"], root), 0);
    assert.equal(await exists(sessionRecordPath(root, "pi-session-1")), false);
  });
});
