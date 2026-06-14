#!/bin/sh
# Git pre-commit chokepoint for dadaia-pi-workspace.
exec dadaia-pi hooks pre-commit-check "$@"
