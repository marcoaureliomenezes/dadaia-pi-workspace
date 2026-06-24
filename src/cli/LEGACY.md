# Legacy TypeScript CLI

This tree is retained for compatibility checks during the Python migration. It is not the authoritative lifecycle CLI.

Authoritative lifecycle command behavior belongs in `src/dadaia_pi/**` and is exposed through the Python CLI or the npm `bin/dadaia-pi.mjs` shim.

Do not add new lifecycle features here. If a Pi/browser adapter needs data, call the Python CLI or Python bridge.
