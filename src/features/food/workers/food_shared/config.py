"""Worker configuration. Nothing has a default; errors name variables, never their values."""

from __future__ import annotations

import hashlib
import json
import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

FOOD_ROOT = Path(__file__).resolve().parents[2]
# Whatever GEO_CODES_PATH points at must match the checksum committed beside the vendored file.
# The API checks the same one.
GEO_CODES_CHECKSUM = FOOD_ROOT / "data" / "geo_codes.v03.json.sha256"


class ConfigError(RuntimeError):
    pass


def load_env_files() -> None:
    """Fills unset environment variables from the local env files. The first value wins:
    workers/.env.local (the food_worker DATABASE_URL), then the files shared with the rest of the
    stack. scripts/dev-up.sh generates both .env.local files."""
    for path in (FOOD_ROOT / "workers" / ".env.local", FOOD_ROOT / ".env.local", FOOD_ROOT / ".env"):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def require(env: Mapping[str, str], *names: str) -> list[str]:
    """The values of `names`, or a ConfigError listing every one that is unset or empty."""
    missing = [name for name in names if not env.get(name)]
    if missing:
        raise ConfigError(f"missing required environment variables: {', '.join(missing)}")
    return [env[name] for name in names]


def load_geo_codes(env: Mapping[str, str]) -> dict:
    """The checksum-verified geo codes. A relative GEO_CODES_PATH starts at the feature root."""
    (raw_path,) = require(env, "GEO_CODES_PATH")
    path = FOOD_ROOT / raw_path
    try:
        content = path.read_bytes()
        expected = GEO_CODES_CHECKSUM.read_text(encoding="utf-8").split()[0]
    except OSError as cause:
        raise ConfigError(f"GEO_CODES_PATH: cannot read {cause.filename}") from cause
    if hashlib.sha256(content).hexdigest() != expected:
        raise ConfigError(f"GEO_CODES_PATH: sha256 differs from data/{GEO_CODES_CHECKSUM.name}")
    return json.loads(content)


@dataclass(frozen=True)
class WorkerConfig:
    database_url: str
    valkey_url: str
    geo_codes: dict


def load_worker_config(env: Mapping[str, str]) -> WorkerConfig:
    database_url, valkey_url, _ = require(env, "DATABASE_URL", "VALKEY_URL", "GEO_CODES_PATH")
    return WorkerConfig(
        database_url=database_url, valkey_url=valkey_url, geo_codes=load_geo_codes(env)
    )
