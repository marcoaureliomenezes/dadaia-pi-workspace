export {
  PI_PACKAGE_RESOURCE_DIRS,
  createProjectSettings,
  validatePiPackageManifest,
  type PiPackageManifestShape,
  type PiPackageResourceDir,
  type ProjectSettings,
} from "./packageResources.js";
export { bindCurrentSession, parseBindArgs, releaseCurrentSession, statusCurrentSession, type ParsedBindArgs } from "./extensionCommands.js";
export { writeProjectSettings } from "./projectSettings.js";
