"""Shared error types for the Python CLI."""

from __future__ import annotations


class DadaiaError(Exception):
    """Base class for expected CLI errors."""

    def __init__(self, message: str, *, code: str = "DADAIA_ERROR", exit_code: int = 1) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.exit_code = exit_code
