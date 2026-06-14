import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { run } from "../src/cli/main.js";
import { validateCatalog } from "../src/features/memory/catalog.js";
import { runSpecsDoctor } from "../src/features/specs/doctor.js";
import { scaffoldSpecs } from "../src/features/specs/scaffold.js";

async function tempSpecs(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dadaia-pi-specs-"));
  return join(root, "specs");
}

async function writeApprovedRelease(specsDir: string): Promise<void> {
  const releaseDir = join(specsDir, "releases", "bootstrap");
  await mkdir(releaseDir, { recursive: true });
  await writeFile(join(releaseDir, "SPEC.md"), "# SPEC\n\n**Status:** Aprovado\n", "utf8");
  await writeFile(join(releaseDir, "PLAN.md"), "# PLAN\n\n**Status:** Aprovado\n", "utf8");
  await writeFile(
    join(releaseDir, "TASKS.md"),
    "# TASKS\n\n**Status:** Aprovado\n\n- [-] T-001 Example\n  - Owner: software-engineer\n  - Write set: `src/**`\n  - Acceptance: works.\n",
    "utf8",
  );
  await writeFile(join(specsDir, "releases", "ACTIVE.md"), "---\nrelease: bootstrap\nphase: IMPLEMENTATION\n---\n", "utf8");
}

describe("specs scaffold and doctor", () => {
  it("scaffolds a specs tree that can be made doctor-clean", async () => {
    const specsDir = await tempSpecs();
    await scaffoldSpecs(specsDir);
    await writeApprovedRelease(specsDir);

    const report = await runSpecsDoctor(specsDir);
    assert.deepEqual(report.summary, { errors: 0, warnings: 0 });
  });

  it("detects catalog drift", async () => {
    const specsDir = await tempSpecs();
    await scaffoldSpecs(specsDir);
    await writeApprovedRelease(specsDir);
    await writeFile(
      join(specsDir, "memory", "product", "new-capability.md"),
      "---\nslug: new-capability\ntitle: New Capability\ncategory: product\ntldr: x\nsummary: x\ntags: []\nagent_tier: self-pull\ntoken_estimate: 1\nlast_updated: 2026-06-14\nrelease_origin: test\n---\n\n## Propósito\n\nTest.\n",
      "utf8",
    );

    const result = await validateCatalog(specsDir);
    assert.deepEqual(result.missingFromCatalog, ["new-capability"]);
    const report = await runSpecsDoctor(specsDir);
    assert.equal(report.summary.errors, 0);
    assert.equal(report.summary.warnings, 1);
  });

  it("exposes specs scaffold and specs doctor through the CLI", async () => {
    const root = await mkdtemp(join(tmpdir(), "dadaia-pi-cli-"));
    assert.equal(await run(["specs", "scaffold"], root), 0);
    await writeApprovedRelease(join(root, "specs"));
    assert.equal(await run(["specs", "doctor"], root), 0);
  });
});
