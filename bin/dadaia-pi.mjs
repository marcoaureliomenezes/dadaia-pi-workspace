#!/usr/bin/env node
// npm/package compatibility shim. Lifecycle authority lives in Python.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const python = process.env.DADAIA_PI_PYTHON || "python3";
const env = {
  ...process.env,
  PYTHONPATH: [join(packageRoot, "src"), process.env.PYTHONPATH].filter(Boolean).join(":"),
};

const child = spawn(python, ["-m", "dadaia_pi", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`failed to launch Python dadaia-pi CLI: ${error.message}`);
  process.exit(127);
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
