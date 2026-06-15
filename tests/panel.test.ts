import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { ContextService } from "../src/features/context/service.js";
import { startPanelServer } from "../src/features/panel/index.js";

type HealthBody = { status: string };
type StatusBody = { root: string; contexts: { name: string }[] };

async function workspaceRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dadaia-pi-panel-"));
}

describe("local browser panel", () => {
  it("serves health, html, and read-only status APIs on loopback", async () => {
    const workspace = await workspaceRoot();
    await new ContextService(workspace).create({ name: "demo", repoSlug: "demo" });
    const panel = await startPanelServer(workspace, { port: 0, open: false });
    try {
      const health = await fetch(new URL("/health", panel.url));
      assert.equal(health.status, 200);
      assert.equal(((await health.json()) as HealthBody).status, "ok");

      const page = await fetch(panel.url);
      assert.equal(page.status, 200);
      assert.match(await page.text(), /dadaia-pi workspace panel/);

      const status = await fetch(new URL("/api/status", panel.url));
      assert.equal(status.status, 200);
      const body = (await status.json()) as StatusBody;
      assert.equal(body.root, workspace);
      assert.equal(body.contexts.length, 1);
      assert.equal(body.contexts[0]?.name, "demo");
    } finally {
      await new Promise<void>((resolve) => panel.server.close(() => resolve()));
    }
  });

  it("rejects non-loopback binds", async () => {
    await assert.rejects(() => startPanelServer("/tmp", { host: "0.0.0.0", port: 0, open: false }), /loopback bind only/);
  });
});
