import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { run } from "../src/cli/main.js";
import { listHandoffs } from "../src/features/handoff/index.js";

async function tempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dadaia-pi-handoff-cli-"));
}

describe("handoff CLI", () => {
  it("emits, validates, and lists security approvals", async () => {
    const root = await tempRoot();
    const sha = "0123456789abcdef0123456789abcdef01234567";
    assert.equal(await run(["handoff", "approve-security", "--context", "demo", "--commit", sha, "--session-id", "s1", "--release", "v1"], root), 0);
    const items = await listHandoffs(root, "demo");
    assert.equal(items.length, 1);
    const item = items[0];
    assert(item);
    assert.equal(item.agent, "security-reviewer");
    assert.equal(item.verdict, "APPROVED");
    assert.equal(item.commitSha, sha);
    assert.equal(await run(["handoff", "validate", join(root, item.path)], root), 0);
    assert.equal(await run(["handoff", "list", "--context", "demo", "--json"], root), 0);

    const parsed = JSON.parse(await readFile(join(root, item.path), "utf8")) as { metrics: { commit_sha: string } };
    assert.equal(parsed.metrics.commit_sha, sha);
  });

  it("rejects invalid security approval commit shas", async () => {
    const root = await tempRoot();
    await assert.rejects(() => run(["handoff", "approve-security", "--context", "demo", "--commit", "bad"], root), /40-character/);
  });
});
