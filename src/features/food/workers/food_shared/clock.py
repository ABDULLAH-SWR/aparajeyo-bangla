"""The injected clock (Guide §4.1 rule 7)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Protocol

BST = timezone(timedelta(hours=6))


class Clock(Protocol):
    def now(self) -> datetime:
        """The current time, timezone-aware."""
        ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(BST)
