import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { run } from "../src/cli/main.js";
import { createProjectSettings, validatePiPackageManifest, type PiPackageManifestShape } from "../src/pi/index.js";

const root = process.cwd();

function frontmatter(text: string): Record<string, string> {
  assert(text.startsWith("---\n"));
  const end = text.indexOf("\n---", 4);
  assert(end > 0);
  const result: Record<string, string> = {};
  for (const line of text.slice(4, end).split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index < 0) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^['\"]|['\"]$/g, "");
  }
  return result;
}

describe("Pi package resources", () => {
  it("declares a valid Pi package manifest", async () => {
    const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as PiPackageManifestShape;
    assert.deepEqual(validatePiPackageManifest(pkg), []);
  });

  it("ships extension, skill, and prompt resource roots", async () => {
    const extensionFiles = await readdir(join(root, "extensions"));
    assert(extensionFiles.some((file) => file.endsWith(".ts")));

    const skillDirs = await readdir(join(root, "skills"));
    assert(skillDirs.includes("dadaia-pi-workspace"));
    assert(skillDirs.includes("dadaia-spec-navigator"));
    assert(skillDirs.includes("dadaia-spec-definition"));
    assert(skillDirs.includes("dadaia-task-manager"));
    assert(skillDirs.includes("dadaia-implementation"));
    assert(skillDirs.includes("dadaia-review"));
    assert(skillDirs.includes("dadaia-handoff-emitter"));
    assert(skillDirs.includes("dadaia-doctor"));
    assert(skillDirs.includes("dadaia-closure"));

    const promptFiles = await readdir(join(root, "prompts"));
    assert(promptFiles.includes("dadaia-define-release.md"));
    assert(promptFiles.includes("dadaia-implement-task.md"));
    assert(promptFiles.includes("dadaia-review.md"));
    assert(promptFiles.includes("dadaia-close-release.md"));
  });

  it("keeps skills loadable by Pi's Agent Skills rules", async () => {
    for (const dir of await readdir(join(root, "skills"))) {
      const text = await readFile(join(root, "skills", dir, "SKILL.md"), "utf8");
      const meta = frontmatter(text);
      assert.match(meta.name ?? "", /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/);
      assert((meta.description ?? "").length > 0);
      assert((meta.description ?? "").length <= 1024);
    }
  });

  it("keeps core skills Pi-native and free of old projection instructions", async () => {
    const forbidden = [/\.claude\b/i, /\.codex\b/i, /\.opencode\b/i, /\.dadaia\//i, /Claude Code/i, /OpenCode/i];
    for (const dir of await readdir(join(root, "skills"))) {
      const text = await readFile(join(root, "skills", dir, "SKILL.md"), "utf8");
      for (const pattern of forbidden) assert(!pattern.test(text), `${dir} contains forbidden ${pattern}`);
    }
  });

  it("keeps prompt templates invokable by filename", async () => {
    for (const file of await readdir(join(root, "prompts"))) {
      if (!file.endsWith(".md")) continue;
      const text = await readFile(join(root, "prompts", file), "utf8");
      const meta = frontmatter(text);
      assert((meta.description ?? "").length > 0, `${file} needs description`);
    }
  });

  it("generates consumer project settings without treating .pi as package source", async () => {
    assert.deepEqual(createProjectSettings("npm:dadaia-pi-workspace@0.1.0"), {
      packages: ["npm:dadaia-pi-workspace@0.1.0"],
    });
    const workspace = await mkdtemp(join(tmpdir(), "dadaia-pi-settings-"));
    assert.equal(await run(["package", "project-settings", "--source", "npm:dadaia-pi-workspace@0.1.0"], workspace), 0);
    const settings = JSON.parse(await readFile(join(workspace, ".pi", "settings.json"), "utf8")) as { packages: string[] };
    assert.deepEqual(settings.packages, ["npm:dadaia-pi-workspace@0.1.0"]);
  });
});
