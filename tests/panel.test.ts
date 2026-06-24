import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { ContextService } from "../src/features/context/service.js";
import { startPanelServer } from "../src/features/panel/index.js";

type HealthBody = { status: string };
type StatusBody = { root: string; contexts: { name: string }[] };
type WorkflowDefinitionBody = { id: string; orchestration?: { engine: string; steps: { title: string }[] } }[];
type ReportsBody = { contexts: { context: string; reports: { path: string; title: string }[] }[] };

async function workspaceRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dadaia-pi-panel-"));
}

describe("local browser panel", () => {
  it("serves health, html, and read-only status APIs on loopback", async () => {
    const workspace = await workspaceRoot();
    await new ContextService(workspace).create({ name: "demo", repoSlug: "demo" });
    await mkdir(join(workspace, "repos", "demo", "specs", "memory", "product"), { recursive: true });
    await writeFile(join(workspace, "repos", "demo", "specs", "constitution.md"), "# Constitution\n\n## Principle\n", "utf8");
    await writeFile(join(workspace, "repos", "demo", "specs", "memory", "architecture.md"), "---\ntitle: Architecture\n---\n# Architecture\n\n```mermaid\ngraph TD\n  A-->B\n```\n", "utf8");
    await writeFile(join(workspace, "repos", "demo", "specs", "memory", "quality-assurance.md"), "# QA\n", "utf8");
    await writeFile(join(workspace, "repos", "demo", "specs", "memory", "product", "catalog.json"), "[]\n", "utf8");
    await mkdir(join(workspace, ".dadaia-pi", "reports", "demo", "workflows"), { recursive: true });
    await writeFile(join(workspace, ".dadaia-pi", "reports", "demo", "workflows", "sample.md"), "# Sample Report\n\nDetails.\n", "utf8");
    const panel = await startPanelServer(workspace, { port: 0, open: false });
    try {
      const health = await fetch(new URL("/health", panel.url));
      assert.equal(health.status, 200);
      assert.equal(((await health.json()) as HealthBody).status, "ok");

      const page = await fetch(panel.url);
      assert.equal(page.status, 200);
      const pageText = await page.text();
      assert.match(pageText, /dadaia-pi workspace panel/);
      assert.match(pageText, /Projects/);
      assert.match(pageText, /Reports/);
      assert.doesNotMatch(pageText, /data-tab="memory"/);
      assert.match(pageText, /Constitution/);
      assert.match(pageText, /Architecture/);
      assert.match(pageText, /quality-assurance/);

      const specMemory = await fetch(new URL("/spec-memory?context=demo&file=architecture.md", panel.url));
      assert.equal(specMemory.status, 200);
      const specMemoryText = await specMemory.text();
      assert.match(specMemoryText, /Document metadata/);
      assert.match(specMemoryText, /<h1 id="architecture">Architecture<\/h1>/);
      assert.match(specMemoryText, /class="mermaid"/);

      const constitution = await fetch(new URL("/constitution?context=demo", panel.url));
      assert.equal(constitution.status, 200);
      assert.match(await constitution.text(), /<h1 id="constitution">Constitution<\/h1>/);

      const workflowDefinitions = await fetch(new URL("/api/workflow-definitions", panel.url));
      assert.equal(workflowDefinitions.status, 200);
      const definitions = (await workflowDefinitions.json()) as WorkflowDefinitionBody;
      const releaseImplementation = definitions.find((item) => item.id === "release-implementation");
      assert.equal(releaseImplementation?.orchestration?.engine, "python");
      assert.ok(releaseImplementation?.orchestration?.steps.some((step) => step.title === "Create tests first"));

      const reports = await fetch(new URL("/api/reports", panel.url));
      assert.equal(reports.status, 200);
      const reportsBody = (await reports.json()) as ReportsBody;
      const sample = reportsBody.contexts[0]?.reports.find((item) => item.path.endsWith("sample.md"));
      assert.ok(sample);
      const reportPage = await fetch(new URL(`/report?path=${encodeURIComponent(sample.path)}`, panel.url));
      assert.equal(reportPage.status, 200);
      assert.match(await reportPage.text(), /Sample Report/);

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
