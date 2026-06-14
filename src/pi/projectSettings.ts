import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { createProjectSettings } from "./packageResources.js";

export async function writeProjectSettings(workspaceRoot: string, packageSource: string): Promise<string> {
  const piDir = join(workspaceRoot, ".pi");
  await mkdir(piDir, { recursive: true });
  const path = join(piDir, "settings.json");
  await writeFile(path, `${JSON.stringify(createProjectSettings(packageSource), null, 2)}\n`, "utf8");
  return path;
}
