"""OpenStreetMap source: Geofabrik download, osm2pgsql Flex load (food.lua) and candidate
extraction."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

import httpx
import psycopg
from psycopg.rows import DictRow

from food_poi_import.classify import classify_osm_tags
from food_poi_import.staging import Candidate
from food_shared.bangla_norm import resolve_bilingual_names
from food_shared.config import DATA_DIR
from food_shared.db import now_bst_iso

GEOFABRIK_PBF_URL = "https://download.geofabrik.de/asia/bangladesh-latest.osm.pbf"
PBF_PATH = DATA_DIR / "bangladesh-latest.osm.pbf"
PBF_META_PATH = DATA_DIR / "bangladesh-latest.meta.json"
FOOD_LUA_PATH = Path(__file__).resolve().parent / "food.lua"
# The one schema food_worker may create tables in (migration 0010).
STAGING_SCHEMA = "osm_stage"


def download_pbf_if_needed(force: bool = False) -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": "AparajeyoFoodSync/0.1 (https://aparajeyo.com)"}
    if PBF_META_PATH.exists() and PBF_PATH.exists() and not force:
        meta = json.loads(PBF_META_PATH.read_text(encoding="utf-8"))
        if meta.get("etag"):
            headers["If-None-Match"] = meta["etag"]
        if meta.get("last_modified"):
            headers["If-Modified-Since"] = meta["last_modified"]

    with (
        httpx.Client(follow_redirects=True, timeout=300.0) as client,
        client.stream("GET", GEOFABRIK_PBF_URL, headers=headers) as resp,
    ):
        if resp.status_code == 304 and PBF_PATH.exists():
            return PBF_PATH
        resp.raise_for_status()
        tmp = PBF_PATH.with_suffix(".osm.pbf.part")
        with tmp.open("wb") as fh:
            for chunk in resp.iter_bytes(chunk_size=1024 * 256):
                fh.write(chunk)
        tmp.replace(PBF_PATH)
        PBF_META_PATH.write_text(
            json.dumps(
                {
                    "etag": resp.headers.get("etag"),
                    "last_modified": resp.headers.get("last-modified"),
                    "downloaded_at": now_bst_iso(),
                    "bytes": PBF_PATH.stat().st_size,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
    return PBF_PATH


def _wsl_path(path: Path) -> str:
    resolved = str(path.resolve())
    drive, rest = resolved[0].lower(), resolved[2:].replace("\\", "/")
    return f"/mnt/{drive}{rest}"


def load_osm_staging(osm_path: Path, info: psycopg.ConnectionInfo) -> None:
    """Replaces osm_stage.osm_food_staging with the food features of an .osm or .osm.pbf file.

    Uses a local osm2pgsql, or the official image through Docker in WSL.
    """
    host = "127.0.0.1" if info.host in ("localhost", "127.0.0.1", "") else info.host
    args = [
        "--create",
        "--output=flex",
        f"--schema={STAGING_SCHEMA}",
        f"--host={host}",
        f"--port={info.port}",
        f"--database={info.dbname}",
        f"--user={info.user}",
    ]
    env = os.environ | {"PGPASSWORD": info.password}

    if shutil.which("osm2pgsql"):
        cmd = ["osm2pgsql", *args, f"--style={FOOD_LUA_PATH}", str(osm_path)]
    else:
        # WSLENV forwards the variable into WSL, keeping the password off the command line.
        env["WSLENV"] = ":".join(filter(None, ["PGPASSWORD", os.environ.get("WSLENV")]))
        osm = Path(osm_path).resolve()
        cmd = [
            "wsl", "-d", os.environ.get("FOOD_WSL_DISTRO", "Ubuntu"), "--exec",
            "docker", "run", "--rm", "--network", "host", "-e", "PGPASSWORD",
            "-v", f"{_wsl_path(osm.parent)}:/input:ro",
            "-v", f"{_wsl_path(FOOD_LUA_PATH)}:/style/food.lua:ro",
            "iboates/osm2pgsql:latest",
            "osm2pgsql", *args, "--style=/style/food.lua", f"/input/{osm.name}",
        ]  # fmt: skip
    # A fixed program with arguments built here, and no shell.
    subprocess.run(cmd, env=env, check=True)  # noqa: S603


def read_candidates(cur: psycopg.Cursor[DictRow], cmap: dict[str, Any]) -> list[Candidate]:
    """Classifies the staged features, then drops what osm2pgsql left in the staging schema."""
    cur.execute(
        # Only the constant schema name is interpolated.
        f"SELECT osm_type, osm_id, tags, ST_X(geom) AS lng, ST_Y(geom) AS lat"  # noqa: S608
        f" FROM {STAGING_SCHEMA}.osm_food_staging ORDER BY osm_type, osm_id"
    )
    candidates: list[Candidate] = []
    for row in cur.fetchall():
        tags = row["tags"]
        category, cuisines = classify_osm_tags(tags, cmap)
        if not category:
            continue
        name_en, name_bn = resolve_bilingual_names(
            tags.get("name"), tags.get("name:en"), tags.get("name:bn")
        )
        if not name_en and not name_bn:
            continue
        kind = {"N": "node", "W": "way"}.get(row["osm_type"], "relation")
        candidates.append(
            Candidate(
                source="osm",
                source_id=f"{kind}/{row['osm_id']}",
                name_en=name_en,
                name_bn=name_bn,
                category=category,
                cuisines=cuisines,
                tags=tags,
                source_license="ODbL-1.0",
                source_confidence=None,
                lng=row["lng"],
                lat=row["lat"],
            )
        )
    # osm2pgsql's properties table too: left behind, it belongs to whoever ran first (the
    # owner role, when it also loads the boundaries) and the next food_worker run may not
    # write to it.
    cur.execute(
        f"DROP TABLE IF EXISTS {STAGING_SCHEMA}.osm_food_staging,"
        f" {STAGING_SCHEMA}.osm2pgsql_properties"
    )
    return candidates
