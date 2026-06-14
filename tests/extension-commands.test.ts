import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { ContextService } from "../src/features/context/service.js";
import { SessionBindingService } from "../src/features/context/sessionBinding.js";
import { bindCurrentSession, parseBindArgs, releaseCurrentSession, statusCurrentSession } from "../src/pi/extensionCommands.js";

async function root(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dadaia-pi-extension-"));
}

describe("Pi extension binding commands", () => {
  it("parses bind command arguments", () => {
    assert.deepEqual(parseBindArgs("demo --mode implementation --release v1"), { context: "demo", mode: "implementation", release: "v1" });
    assert.deepEqual(parseBindArgs('"demo ctx" --mode read'), { context: "demo ctx", mode: "read" });
    assert.throws(() => parseBindArgs(""), /requires <context>/);
    assert.throws(() => parseBindArgs("demo --mode"), /requires a value/);
    assert.throws(() => parseBindArgs("demo --wat"), /Unknown/);
  });

  it("binds, reports, and releases the current Pi session id", async () => {
    const workspace = await root();
    await new ContextService(workspace).create({ name: "demo", repoSlug: "demo" });

    assert.rejects(() => bindCurrentSession(workspace, "pi-session", "demo --mode implementation"), /requires --release/);
    const bound = await bindCurrentSession(workspace, "pi-session", "demo --mode implementation --release v1", 123);
    assert.match(bound, /bound pi-session to demo/);
    assert.equal((await new SessionBindingService(workspace).status("pi-session")).release, "v1");

    const status = await statusCurrentSession(workspace, "pi-session");
    assert.match(status, /bound to demo/);

    const released = await releaseCurrentSession(workspace, "pi-session");
    assert.match(released, /released pi-session from demo/);
    assert.equal(await new SessionBindingService(workspace).read("pi-session"), undefined);
  });
});
