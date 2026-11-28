"""The POI import: OSM and Overture -> staging -> admin areas -> places -> conflation.

`food-poi-import` runs it against the downloaded Bangladesh sources.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path
from typing import Any

import psycopg
import yaml
from psycopg.rows import dict_row
from valkey import Valkey, from_url

from food_poi_import import osm_ingest, overture_ingest, staging
from food_poi_import.boundaries import seed_cod_ab_boundaries
from food_poi_import.conflate import (
    backfill_merged_into,
    conflate_osm_and_overture,
    keep_merged_details,
)
from food_poi_import.staging import ImportSanityError
from food_shared.cache import bump_epoch
from food_shared.clock import BST, Clock, SystemClock
from food_shared.config import load_env_files, load_worker_config, require
from food_shared.db import get_pg_connection

__all__ = ["ImportSanityError", "run_import"]

CATEGORY_MAP_PATH = Path(__file__).resolve().parents[1] / "food_shared" / "category_map.yaml"


def run_import(
    osm_path: Path,
    overture_path: Path | None,
    conn: psycopg.Connection[Any],
    clock: Clock,
    *,
    valkey: Valkey,
) -> dict:
    """Imports both sources in one transaction and commits it, then invalidates the API cache if any
    place changed. `conn` must have no transaction open.

    `overture_path=None` leaves Overture rows untouched.
    """
    cmap = yaml.safe_load(CATEGORY_MAP_PATH.read_text(encoding="utf-8"))
    started_at = clock.now()
    # A separate process, so the staging table is committed before this transaction reads it.
    osm_ingest.load_osm_staging(osm_path, conn.info)

    with conn.transaction(), conn.cursor(row_factory=dict_row) as cur:
        # Inserted first because food_import_rejects rows point at the run.
        cur.execute(
            """
            INSERT INTO sync_runs (source, dataset_version, imported_count, status, started_at)
            VALUES ('food_poi_import', '', 0, 'running', %s) RETURNING id
            """,
            (started_at,),
        )
        (run,) = cur.fetchall()
        run_id = run["id"]

        sources = {"osm": osm_ingest.read_candidates(cur, cmap)}
        if overture_path is not None:
            sources["overture"] = overture_ingest.read_candidates(overture_path, cmap)
        counts = {source: len(rows) for source, rows in sources.items()}

        staging.create_candidates(cur, [c for rows in sources.values() for c in rows])
        staging.assign_admin_areas(cur)
        rejected = staging.reject_unassigned(cur, run_id)
        for source in sources:
            staging.require_complete_source(cur, source)
        keep_merged_details(cur)
        staging.upsert_places(cur)
        conflation = conflate_osm_and_overture(cur)
        for source in sources:
            staging.deactivate_missing(cur, source)
        rows_changed = staging.count_changed_places(cur)

        finished_at = clock.now()
        dataset_version = finished_at.astimezone(BST).strftime("%Y-%m-%d")
        cur.execute(
            """
            UPDATE sync_runs
            SET dataset_version = %s, imported_count = %s, status = 'succeeded',
                finished_at = %s, notes = %s::jsonb
            WHERE id = %s
            """,
            (
                dataset_version,
                sum(counts.values()) - rejected,
                finished_at,
                json.dumps(
                    {
                        "candidates": counts,
                        "rejected": rejected,
                        "conflation": conflation,
                        "rows_changed": rows_changed,
                    }
                ),
                run_id,
            ),
        )
    conn.commit()
    if rows_changed > 0:
        bump_epoch(valkey, "food_poi_import")

    return {
        "status": "synced",
        "candidates": counts,
        "rejected": rejected,
        "conflation": conflation,
        "rows_changed": rows_changed,
        "dataset_version": dataset_version,
        "synced_at": finished_at.isoformat(timespec="seconds"),
    }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-download", action="store_true", help="reuse the downloaded OSM file")
    parser.add_argument("--skip-overture", action="store_true")
    parser.add_argument("--backfill-merged-into", action="store_true")
    args = parser.parse_args()
    load_env_files()

    if args.backfill_merged_into:
        (database_url,) = require(os.environ, "DATABASE_URL")
        with get_pg_connection(database_url) as conn:
            print(json.dumps({"merged_into_backfilled": backfill_merged_into(conn)}))
        return

    config = load_worker_config(os.environ)
    with get_pg_connection(config.database_url) as conn:
        seed_cod_ab_boundaries(conn, config.geo_codes)
        reuse = args.skip_download and osm_ingest.PBF_PATH.exists()
        osm_path = osm_ingest.PBF_PATH if reuse else osm_ingest.download_pbf_if_needed()
        overture_path = (
            None if args.skip_overture else overture_ingest.download_overture_if_needed()
        )
        with from_url(config.valkey_url) as valkey:
            result = run_import(osm_path, overture_path, conn, SystemClock(), valkey=valkey)
        print(json.dumps(result))


if __name__ == "__main__":
    main()
