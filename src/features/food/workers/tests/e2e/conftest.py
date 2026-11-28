"""The real API, started with Bun against the test's database, Valkey, Garage and imgproxy."""

from __future__ import annotations

import os
import socket
import subprocess
import time
from collections.abc import Callable, Iterator
from urllib.parse import urlsplit, urlunsplit

import httpx
import pytest

from food_shared.config import FOOD_ROOT


def _free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


@pytest.fixture
def start_api(bun, food_db, valkey_db, media_stack) -> Iterator[Callable[[], str]]:
    """Starts the API on demand and returns its base URL."""
    processes: list[subprocess.Popen[bytes]] = []

    def start() -> str:
        port = _free_port()
        # Database 10 is the workers' Valkey database (see valkey_db).
        valkey_url = urlunsplit(urlsplit(os.environ["VALKEY_URL"])._replace(path="/10"))
        env = os.environ | {
            "NODE_ENV": "test",
            "PORT": str(port),
            "DATABASE_URL": food_db.url,
            "VALKEY_URL": valkey_url,
            "IMGPROXY_BASE_URL": media_stack["IMGPROXY_BASE_URL"],
            "IMGPROXY_KEY": media_stack["IMGPROXY_KEY"],
            "IMGPROXY_SALT": media_stack["IMGPROXY_SALT"],
            "CORS_ALLOWED_ORIGINS": "http://localhost:3000",
            "FOOD_INTERNAL_BIND_ADDR": "127.0.0.1",
            "FOOD_INTERNAL_PORT": str(_free_port()),  # a running dev API may hold 8003
            "FOOD_INVALIDATE_TOKEN": "x" * 32,
            "GEO_CODES_PATH": str(FOOD_ROOT / "data" / "geo_codes.v03.json"),
        }
        # A developer's S3_BUCKET must not reach the API: its default is under test.
        env.pop("S3_BUCKET", None)
        process = subprocess.Popen(  # noqa: S603  (the repository's own server)
            [bun, "server.ts"], cwd=FOOD_ROOT / "api", env=env
        )
        processes.append(process)
        base_url = f"http://127.0.0.1:{port}"
        for _ in range(100):
            if process.poll() is not None:
                pytest.fail(f"the API exited with code {process.returncode}")
            try:
                httpx.get(f"{base_url}/api/v1/food/health", timeout=2)
                return base_url
            except httpx.TransportError:
                time.sleep(0.2)
        pytest.fail("the API did not start")

    yield start
    for process in processes:
        process.terminate()
        process.wait(timeout=10)
