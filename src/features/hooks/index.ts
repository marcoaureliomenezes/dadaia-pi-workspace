export { installAllHooks, installHook, uninstallAllHooks, uninstallHook, type HookName } from "./install.js";
export { preCommitCheck, type HookCheckResult as PreCommitHookCheckResult } from "./preCommit.js";
export { prePushCheck, type HookCheckResult as PrePushHookCheckResult } from "./prePush.js";
