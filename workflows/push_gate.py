#!/usr/bin/env python3
from _workflow_common import main

main("push_gate.py", [
    "Push gate policy: before public push, verify every pushed commit is inside an approved RC range and covered by QA, architecture, security, and code review evidence. Security review must inspect secrets, trust boundaries, hooks, package resources, and sensitive paths.",
])
