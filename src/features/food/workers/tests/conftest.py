"""Tests are an entry point too: unset variables come from the local env files."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
import respx

from food_shared.config import load_env_files

load_env_files()

SUITES = ("unit", "integration", "e2e")


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    """A test's directory is its marker, which is how CI selects `unit or integration`."""
    tests = Path(__file__).parent
    for item in items:
        suite = item.path.relative_to(tests).parts[0]
        if suite in SUITES:
            item.add_marker(suite)


@pytest.fixture(autouse=True)
def http_mock(request: pytest.FixtureRequest) -> Iterator[respx.MockRouter | None]:
    """Strict mode: an httpx request that the test did not mock on this router fails it.
    e2e tests are exempt, because they talk to the running stack."""
    if request.node.get_closest_marker("e2e"):
        yield None
        return
    with respx.mock(assert_all_mocked=True, assert_all_called=False) as router:
        yield router
