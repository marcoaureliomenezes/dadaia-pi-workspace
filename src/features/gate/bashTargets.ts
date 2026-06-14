import { join } from "node:path";

const REDIRECT_PATTERN = /(?:^|\s)(?:>|>>|2>|&>)\s*([^\s;&|]+)/g;
const WRITE_COMMAND_PATTERN = /\b(?:touch|rm|mv|cp|mkdir|rmdir)\s+([^;&|]+)/g;

function cleanToken(token: string): string {
  return token.trim().replace(/^['\"]|['\"]$/g, "");
}

export function inferBashTargetPaths(cwd: string, command: string): string[] {
  const paths = new Set<string>();
  for (const match of command.matchAll(REDIRECT_PATTERN)) {
    const token = match[1];
    if (token) paths.add(join(cwd, cleanToken(token)));
  }
  for (const match of command.matchAll(WRITE_COMMAND_PATTERN)) {
    const argString = match[1];
    if (!argString) continue;
    for (const raw of argString.split(/\s+/)) {
      const token = cleanToken(raw);
      if (token.startsWith("-") || token.length === 0) continue;
      paths.add(join(cwd, token));
    }
  }
  return [...paths];
}
