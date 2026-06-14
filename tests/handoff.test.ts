import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { validateHandoffRecord } from "../src/core/handoff.js";
import { runWorkspaceDoctor } from "../src/features/doctor/workspaceDoctor.js";

describe("handoff contract", () => {
  it("validates the minimal Pi-native handoff schema", () => {
    assert.deepEqual(
      validateHandoffRecord({
        schemaVersion: 1,
        context: "demo",
        sessionId: "pi-session-1",
        agent: "software-engineer",
        producedAt: "2026-06-14T20:00:00Z",
        scope: "T-001",
        artifact: { type: "handoff" },
        metrics: {},
        findings: [],
      }),
      [],
    );

    assert(validateHandoffRecord({ schemaVersion: 1 }).length > 0);
  });

  it("reports invalid handoff files from workspace doctor", async () => {
    const root = await mkdtemp(join(tmpdir(), "dadaia-pi-handoff-"));
    await mkdir(join(root, ".dadaia-pi", "states"), { recursive: true });
    await writeFile(join(root, ".dadaia-pi", "states", "spec_contexts.json"), JSON.stringify({ schemaVersion: 1, contexts: [] }), "utf8");
    await mkdir(join(root, ".dadaia-pi", "handoff", "demo"), { recursive: true });
    await writeFile(join(root, ".dadaia-pi", "handoff", "demo", "bad.handoff.json"), JSON.stringify({ schemaVersion: 1 }), "utf8");

    const report = await runWorkspaceDoctor(root);
    assert(report.issues.some((issue) => issue.code === "HANDOFF-1" && issue.severity === "error"));
  });
});
