export type ContextState = "ALIVE" | "DEAD";

export interface SpecContextRecord {
  readonly name: string;
  readonly repoSlug: string;
  readonly repoUrl?: string;
  readonly branch: string;
  readonly state: ContextState;
  readonly aliveSince?: string;
  readonly deadSince?: string;
}

export interface SpecContextRegistry {
  readonly schemaVersion: 1;
  readonly contexts: readonly SpecContextRecord[];
}

export function assertContextName(value: string): void {
  if (!/^[a-z0-9](?:[a-z0-9_-]{0,63}[a-z0-9])?$/.test(value)) {
    throw new Error(`Invalid context name: ${value}`);
  }
}

export function assertRepoSlug(value: string): void {
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(value)) {
    throw new Error(`Invalid repo slug: ${value}`);
  }
}
