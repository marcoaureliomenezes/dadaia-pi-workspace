import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { run } from "../src/cli/main.js";
import { VERSION, defaultWorkspaceLayout } from "../src/index.js";

describe("project foundation", () => {
  it("exports a package version", () => {
    assert.equal(VERSION, "0.1.0");
  });

  it("defines the canonical workspace layout", () => {
    assert.deepEqual(defaultWorkspaceLayout(), {
      stateDirName: ".dadaia-pi",
      reposDirName: "repos",
      piDirName: ".pi",
    });
  });

  it("keeps the CLI runner pure enough to test", async () => {
    assert.equal(await run(["--version"]), 0);
    assert.equal(await run(["doctor"], await mkdtemp(join(tmpdir(), "dadaia-pi-doctor-"))), 0);
    assert.equal(await run(["unknown"]), 2);
  });
});
