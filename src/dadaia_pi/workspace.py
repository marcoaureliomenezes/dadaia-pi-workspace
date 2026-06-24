"""Workspace discovery primitives for the Python runtime."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .errors import DadaiaError

ROOT_MARKERS = (".dadaia-pi", "repos")


@dataclass(frozen=True)
class Workspace:
    """Resolved dadaia-pi workspace paths."""

    root: Path

    @property
    def state_dir(self) -> Path:
        return self.root / ".dadaia-pi"

    @property
    def repos_dir(self) -> Path:
        return self.root / "repos"

    @property
    def sessions_dir(self) -> Path:
        return self.state_dir / "sessions"

    @property
    def states_dir(self) -> Path:
        return self.state_dir / "states"


def is_workspace_root(path: Path) -> bool:
    return all((path / marker).exists() for marker in ROOT_MARKERS)


def discover_workspace(start: Path | None = None) -> Workspace:
    """Find the nearest ancestor containing the dadaia-pi workspace markers."""

    current = (start or Path.cwd()).resolve()
    candidates = [current, *current.parents]
    for candidate in candidates:
        if is_workspace_root(candidate):
            return Workspace(candidate)
    raise DadaiaError(
        f"No dadaia-pi workspace found from {current}",
        code="WORKSPACE_NOT_FOUND",
        exit_code=2,
    )
