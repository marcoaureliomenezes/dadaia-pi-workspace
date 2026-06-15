import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { run } from "../src/cli/main.js";
import { doctorWorkspaceInstall, initWorkspace } from "../src/features/workspace/index.js";

const packageRoot = process.cwd();

async function tempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "dadaia-pi-workspace-scaffold-"));
}

describe("workspace scaffold/install", () => {
  it("initializes an instantiated workspace with staged and projected resources", async () => {
    const root = await tempRoot();
    const result = await initWorkspace(root, packageRoot);
    assert(result.actions.length > 0);
    assert.match(await readFile(join(root, "AGENTS.md"), "utf8"), /instantiated dadaia-pi-workspace/);
    assert.match(await readFile(join(root, ".dadaia-pi", "reports", "AGENTS.md"), "utf8"), /reports/);
    assert.match(await readFile(join(root, ".agents", "skills", "dadaia-pi-workspace", "SKILL.md"), "utf8"), /dadaia-pi-workspace/);
    assert.match(await readFile(join(root, ".pi", "prompts", "dadaia-status.md"), "utf8"), /description/);
    assert.equal((await lstat(join(root, ".agents", "skills", "dadaia-pi-workspace"))).isSymbolicLink(), false);
    assert.equal((await doctorWorkspaceInstall(root, packageRoot)).ok, true);
  });

  it("repairs projection drift through the CLI", async () => {
    const root = await tempRoot();
    assert.equal(await run(["workspace", "init", "--package-root", packageRoot], root), 0);
    await writeFile(join(root, ".agents", "skills", "dadaia-pi-workspace", "SKILL.md"), "drift", "utf8");
    assert.equal(await run(["workspace", "doctor", "--package-root", packageRoot], root), 1);
    assert.equal(await run(["workspace", "install", "--package-root", packageRoot], root), 0);
    assert.equal(await run(["workspace", "doctor", "--package-root", packageRoot], root), 0);
  });
});
