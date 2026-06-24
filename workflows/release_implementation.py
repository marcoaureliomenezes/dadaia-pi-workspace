#!/usr/bin/env python3
from _workflow_common import main

main("release_implementation.py", [
    "Release implementation policy: TDD is mandatory. For every task group, create unit and scoped E2E tests first, review tests for spec fidelity, run red, implement only group write-set paths, run green validation, review implementation, and commit the group before the next group.",
    "Push readiness is blocked until deep architecture and security reviews cover the release candidate commit range.",
])
