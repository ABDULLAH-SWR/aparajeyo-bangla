"""Overture Maps source: GeoParquet download and candidate extraction."""

from __future__ import annotations

import sys
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
from overturemaps import core as overture_core
from shapely import wkb

from food_poi_import.classify import classify_overture_row
from food_poi_import.staging import Candidate
from food_shared.bangla_norm import resolve_bilingual_names
from food_shared.config import DATA_DIR

OVERTURE_CACHE_PATH = DATA_DIR / "bd_overture_food.parquet"
BANGLADESH_BBOX = (88.0, 20.5, 92.7, 26.7)
MIN_CONFIDENCE = 0.6
# Only the columns needed for Food filtering and attribution.
COLUMNS = (
    "id",
    "geometry",
    "confidence",
    "names",
    "taxonomy",
    "basic_category",
    "operating_status",
    "addresses",
    "phones",
    "websites",
    "sources",
)


def download_overture_if_needed(use_cache: bool = True) -> Path:
    if use_cache and OVERTURE_CACHE_PATH.exists():
        return OVERTURE_CACHE_PATH

    print("[overture] Streaming Bangladesh places from Overture S3 GeoParquet...", file=sys.stderr)
    reader = overture_core.record_batch_reader(
        "place", bbox=BANGLADESH_BBOX, connect_timeout=15, request_timeout=60
    )
    if reader is None:
        raise RuntimeError("Overture returned no reader for the Bangladesh bbox")

    tables: list[pa.Table] = []
    for number, batch in enumerate(reader, start=1):
        cols = [c for c in COLUMNS if c in batch.schema.names]
        tables.append(pa.Table.from_batches([batch]).select(cols))
        if number % 10 == 0:
            print(f"[overture] Fetched {number} row batches...", file=sys.stderr, flush=True)
    if not tables:
        raise RuntimeError("Overture returned no places for the Bangladesh bbox")

    table = pa.concat_tables(tables)
    OVERTURE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, OVERTURE_CACHE_PATH)
    print(f"[overture] Cached {table.num_rows} raw places", file=sys.stderr, flush=True)
    return OVERTURE_CACHE_PATH


def _names(names_obj: dict | None) -> tuple[str | None, str | None]:
    if not names_obj:
        return None, None
    common_raw = names_obj.get("common")
    common: dict[str, str] = {}
    if isinstance(common_raw, dict):
        common = common_raw
    elif isinstance(common_raw, list):
        for item in common_raw:
            if isinstance(item, (list, tuple)) and len(item) == 2:
                common[item[0]] = item[1]
            elif isinstance(item, dict) and "key" in item and "value" in item:
                common[item["key"]] = item["value"]
    return resolve_bilingual_names(names_obj.get("primary"), common.get("en"), common.get("bn"))


def read_candidates(path: Path, cmap: dict) -> list[Candidate]:
    candidates: list[Candidate] = []
    for row in pq.read_table(path).to_pylist():
        confidence = float(row.get("confidence") or 0.0)
        if confidence < MIN_CONFIDENCE:
            continue
        if row.get("operating_status") in ("permanently_closed", "closed"):
            continue
        category, cuisines = classify_overture_row(row, cmap)
        if not category:
            continue
        name_en, name_bn = _names(row.get("names"))
        if not name_en and not name_bn:
            continue
        if not row.get("geometry"):
            continue
        point = wkb.loads(row["geometry"])

        sources = row.get("sources") or []
        addresses = row.get("addresses") or []
        phones = row.get("phones") or []
        websites = row.get("websites") or []
        tags = {
            "addr:full": addresses[0].get("freeform")
            if addresses and isinstance(addresses[0], dict)
            else None,
            "phone": phones[0] if phones else None,
            "website": websites[0] if websites else None,
            "overture_taxonomy": row.get("taxonomy"),
            "overture_sources": sources,
        }
        candidates.append(
            Candidate(
                source="overture",
                source_id=str(row["id"]),
                name_en=name_en,
                name_bn=name_bn,
                category=category,
                cuisines=cuisines,
                tags={k: v for k, v in tags.items() if v is not None},
                source_license=next(
                    (s["license"] for s in sources if s.get("license")), "CDLA-Permissive-2.0"
                ),
                source_confidence=round(confidence, 2),
                lng=round(float(point.x), 6),
                lat=round(float(point.y), 6),
            )
        )
    return candidates
