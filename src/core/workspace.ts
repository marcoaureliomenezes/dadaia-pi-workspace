export const STATE_DIR_NAME = ".dadaia-pi";

export interface WorkspaceLayout {
  readonly stateDirName: typeof STATE_DIR_NAME;
  readonly reposDirName: "repos";
  readonly piDirName: ".pi";
}

export function defaultWorkspaceLayout(): WorkspaceLayout {
  return {
    stateDirName: STATE_DIR_NAME,
    reposDirName: "repos",
    piDirName: ".pi",
  };
}
