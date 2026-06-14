export type SessionMode = "READ" | "BOUND_IMPLEMENTATION" | "BOUND_REVIEW";

export interface SessionBindingRecord {
  readonly sessionId: string;
  readonly context: string;
  readonly mode: SessionMode;
  readonly release?: string;
  readonly pid?: number;
  readonly boundAt: string;
  readonly lastSeenAt: string;
  readonly ttlSeconds: number;
}

export function assertSessionId(value: string): void {
  if (!/^[a-zA-Z0-9._:-]{1,160}$/.test(value) || value.includes("/") || value.includes("..")) {
    throw new Error(`Invalid session id: ${value}`);
  }
}

export function parseSessionMode(value: string | undefined): SessionMode {
  if (value === undefined || value === "read" || value === "READ" || value === "spec") return "READ";
  if (value === "implementation" || value === "BOUND_IMPLEMENTATION") return "BOUND_IMPLEMENTATION";
  if (value === "review" || value === "BOUND_REVIEW") return "BOUND_REVIEW";
  throw new Error(`Invalid session mode: ${value}`);
}

export function modeRequiresRelease(mode: SessionMode): boolean {
  return mode === "BOUND_IMPLEMENTATION" || mode === "BOUND_REVIEW";
}
