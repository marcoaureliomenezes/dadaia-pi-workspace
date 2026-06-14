export const PI_PACKAGE_RESOURCE_DIRS = ["extensions", "skills", "prompts"] as const;

export type PiPackageResourceDir = (typeof PI_PACKAGE_RESOURCE_DIRS)[number];

export interface PiPackageManifestShape {
  readonly keywords?: readonly string[];
  readonly pi?: Partial<Record<PiPackageResourceDir, readonly string[]>>;
}

export interface ProjectSettings {
  readonly packages: readonly string[];
}

export function createProjectSettings(packageSource: string): ProjectSettings {
  if (packageSource.trim().length === 0) throw new Error("packageSource is required");
  return { packages: [packageSource] };
}

export function validatePiPackageManifest(pkg: PiPackageManifestShape): string[] {
  const issues: string[] = [];
  if (!pkg.keywords?.includes("pi-package")) issues.push("package.json must include keyword 'pi-package'");
  for (const dir of PI_PACKAGE_RESOURCE_DIRS) {
    const value = pkg.pi?.[dir];
    if (!Array.isArray(value) || value.length === 0) issues.push(`package.json must declare pi.${dir}`);
  }
  return issues;
}
