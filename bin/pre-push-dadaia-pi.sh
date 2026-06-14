#!/bin/sh
# Git pre-push chokepoint for dadaia-pi-workspace.
exec dadaia-pi hooks pre-push-check "$@"
