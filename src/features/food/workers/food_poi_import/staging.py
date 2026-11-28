"""The staging table both sources share, and its SQL (Guide Appendix A.11).

geo_districts and geo_upazilas are keyed by `id` here, not by the appendix's district_id /
upazila_id. Every function runs inside the caller's transaction.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any

import psycopg
from psycopg.rows import DictRow

from food_shared.bangla_norm import normalize_match_key, transliterate_bn_for_matching
from food_shared.db import stable_uuid_v4

log = logging.getLogger(__name__)


class ImportSanityError(RuntimeError):
    """A source looks truncated, so the run must not change anything."""


@dataclass(frozen=True)
class Candidate:
    source: str
    source_id: str
    name_en: str | None
    name_bn: str | None
    category: str
    cuisines: list[str]
    tags: dict[str, Any]
    source_license: str
    source_confidence: float | None
    lng: float
    lat: float


def create_candidates(cur: psycopg.Cursor[DictRow], candidates: list[Candidate]) -> None:
    cur.execute(
        """
        CREATE TEMP TABLE tmp_food_candidates (
          cand_id           bigserial PRIMARY KEY,
          id                uuid NOT NULL,
          source            text NOT NULL,
          source_id         text NOT NULL,
          name_en           text,
          name_bn           text,
          name_norm         text NOT NULL,
          name_roman        text,
          category          text NOT NULL,
          cuisines          text[] NOT NULL,
          tags              jsonb NOT NULL,
          source_license    text NOT NULL,
          source_confidence numeric(3,2),
          geom              geometry(Point, 4326) NOT NULL,
          district_id       text,
          upazila_id        text,
          UNIQUE (source, source_id)
        ) ON COMMIT DROP
        """
    )
    with cur.copy(
        "COPY tmp_food_candidates (id, source, source_id, name_en, name_bn, name_norm, name_roman,"
        " category, cuisines, tags, source_license, source_confidence, geom) FROM STDIN"
    ) as copy:
        for c in candidates:
            display_name = c.name_bn or c.name_en
            copy.write_row(
                (
                    stable_uuid_v4(c.source, c.source_id),
                    c.source,
                    c.source_id,
                    c.name_en,
                    c.name_bn,
                    normalize_match_key(display_name),
                    transliterate_bn_for_matching(display_name),
                    c.category,
                    c.cuisines,
                    json.dumps(c.tags, ensure_ascii=False, default=str),
                    c.source_license,
                    c.source_confidence,
                    f"SRID=4326;POINT({c.lng!r} {c.lat!r})",
                )
            )


def assign_admin_areas(cur: psycopg.Cursor[DictRow]) -> None:
    cur.execute(
        """
        UPDATE tmp_food_candidates c SET district_id = (
          SELECT gd.id FROM geo_districts gd
          WHERE ST_Contains(gd.geom, c.geom)
          ORDER BY gd.id LIMIT 1)
        """
    )
    # The && prefilter (0.025 degrees is at least 2.5 km here) lets the GiST index skip
    # distant polygons: the Overture bbox holds many points outside Bangladesh.
    cur.execute(
        """
        UPDATE tmp_food_candidates c SET district_id = (
          SELECT gd.id FROM geo_districts gd
          WHERE gd.geom && ST_Expand(c.geom, 0.025)
            AND ST_DWithin(gd.geom::geography, c.geom::geography, 2000)
          ORDER BY ST_Distance(gd.geom::geography, c.geom::geography), gd.id LIMIT 1)
        WHERE c.district_id IS NULL
        """
    )
    cur.execute(
        """
        UPDATE tmp_food_candidates c SET upazila_id = (
          SELECT gu.id FROM geo_upazilas gu
          WHERE gu.district_id = c.district_id AND ST_Contains(gu.geom, c.geom)
          ORDER BY gu.id LIMIT 1)
        WHERE c.district_id IS NOT NULL
        """
    )
    cur.execute(
        """
        UPDATE tmp_food_candidates c SET upazila_id = (
          SELECT gu.id FROM geo_upazilas gu
          WHERE gu.district_id = c.district_id
            AND gu.geom && ST_Expand(c.geom, 0.025)
            AND ST_DWithin(gu.geom::geography, c.geom::geography, 2000)
          ORDER BY ST_Distance(gu.geom::geography, c.geom::geography), gu.id LIMIT 1)
        WHERE c.district_id IS NOT NULL AND c.upazila_id IS NULL
        """
    )


def reject_unassigned(cur: psycopg.Cursor[DictRow], run_id: int) -> int:
    """Records, then drops, the candidates that no district claimed."""
    cur.execute(
        """
        INSERT INTO food_import_rejects (run_id, source, source_id, reason, geom)
        SELECT %s, source, source_id, 'outside_admin_polygons', geom
        FROM tmp_food_candidates WHERE district_id IS NULL
        """,
        (run_id,),
    )
    rejected = cur.rowcount
    cur.execute("DELETE FROM tmp_food_candidates WHERE district_id IS NULL")
    if rejected:
        log.warning("dropped %d candidates outside the admin polygons (run %d)", rejected, run_id)
    return rejected


def require_complete_source(cur: psycopg.Cursor[DictRow], source: str) -> None:
    """Raises unless the source has candidates for at least 80 % of its currently active rows."""
    cur.execute(
        """
        SELECT
          (SELECT COUNT(*) FROM tmp_food_candidates WHERE source = %(source)s) AS candidates,
          (SELECT COUNT(*) FROM places
           WHERE overlay_type = 'food' AND source = %(source)s AND is_active) AS active
        """,
        {"source": source},
    )
    (row,) = cur.fetchall()
    if row["candidates"] * 5 < row["active"] * 4:
        raise ImportSanityError(
            f"{source}: {row['candidates']} candidates for {row['active']} active rows (below 80 %)"
        )


def upsert_places(cur: psycopg.Cursor[DictRow]) -> None:
    cur.execute(
        """
        INSERT INTO places AS p (id, overlay_type, source, source_id, district_id, upazila_id, geom,
                                 name_en, name_bn, name_norm, name_roman, category, cuisines, tags,
                                 source_license, source_confidence, is_active, missed_imports,
                                 last_seen_at)
        SELECT c.id, 'food', c.source, c.source_id, c.district_id, c.upazila_id, c.geom,
               c.name_en, c.name_bn, c.name_norm, c.name_roman, c.category, c.cuisines, c.tags,
               c.source_license, c.source_confidence, true, 0, now()
        FROM tmp_food_candidates c
        ON CONFLICT (source, source_id) DO UPDATE SET
          district_id       = EXCLUDED.district_id,
          upazila_id        = EXCLUDED.upazila_id,
          geom              = EXCLUDED.geom,
          name_en           = EXCLUDED.name_en,
          name_bn           = EXCLUDED.name_bn,
          name_norm         = EXCLUDED.name_norm,
          name_roman        = EXCLUDED.name_roman,
          category          = EXCLUDED.category,
          cuisines          = EXCLUDED.cuisines,
          tags              = EXCLUDED.tags,
          source_license    = EXCLUDED.source_license,
          source_confidence = EXCLUDED.source_confidence,
          missed_imports    = 0,
          last_seen_at      = EXCLUDED.last_seen_at,
          is_active         = (p.merged_into IS NULL),
          updated_at        = CASE
            WHEN (p.district_id, p.upazila_id, p.geom, p.name_en, p.name_bn, p.category, p.cuisines,
                  p.tags, p.source_license, p.is_active)
                 IS DISTINCT FROM
                 (EXCLUDED.district_id, EXCLUDED.upazila_id, EXCLUDED.geom, EXCLUDED.name_en,
                  EXCLUDED.name_bn, EXCLUDED.category, EXCLUDED.cuisines, EXCLUDED.tags,
                  EXCLUDED.source_license, (p.merged_into IS NULL))
            THEN now() ELSE p.updated_at END
        """
    )


def deactivate_missing(cur: psycopg.Cursor[DictRow], source: str) -> None:
    """Counts a missed import for each of the source's rows absent from staging; the second miss
    deactivates the row."""
    cur.execute(
        """
        UPDATE places p
        SET missed_imports = p.missed_imports + 1,
            is_active      = CASE WHEN p.missed_imports + 1 >= 2 THEN false ELSE p.is_active END,
            updated_at     = CASE WHEN p.missed_imports + 1 >= 2 AND p.is_active THEN now()
                                  ELSE p.updated_at END
        WHERE p.overlay_type = 'food'
          AND p.source = %s
          AND p.merged_into IS NULL
          AND NOT EXISTS (SELECT 1 FROM tmp_food_candidates c
                          WHERE c.source = p.source AND c.source_id = p.source_id)
        """,
        (source,),
    )


def count_changed_places(cur: psycopg.Cursor[DictRow]) -> int:
    """Places this transaction inserted or visibly changed: every such write sets updated_at to the
    transaction's now()."""
    cur.execute(
        "SELECT COUNT(*) AS changed FROM places WHERE overlay_type = 'food' AND updated_at = now()"
    )
    (row,) = cur.fetchall()
    return int(row["changed"])
