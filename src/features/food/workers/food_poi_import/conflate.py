"""Merges Overture duplicates into OSM survivors (Guide §5.4): 50 m, same category,
pg_trgm similarity."""

from __future__ import annotations

from typing import Any

import psycopg
from psycopg.rows import DictRow

# Name similarity at which a pair is merged, or else queued for review.
AUTO_MERGE_SIMILARITY = 0.55
REVIEW_SIMILARITY = 0.35
# The tags a survivor takes from a merged duplicate.
CONTACT_KEYS = ("phone", "website", "addr:full")


def keep_merged_details(cur: psycopg.Cursor[DictRow]) -> None:
    """Reapplies to staged survivors what they took from their merged duplicates, so that the upsert
    neither discards it nor reports a change. As in conflation, the earlier merge wins."""
    cur.execute(
        """
        WITH merged AS (
          SELECT s.cand_id, m.position,
                 CASE WHEN c.cand_id IS NULL THEN loser.name_en ELSE c.name_en END AS name_en,
                 CASE WHEN c.cand_id IS NULL THEN loser.name_bn ELSE c.name_bn END AS name_bn,
                 CASE WHEN c.cand_id IS NULL THEN loser.tags ELSE c.tags END AS tags
          FROM tmp_food_candidates s
          JOIN places survivor ON survivor.source = s.source AND survivor.source_id = s.source_id
          CROSS JOIN LATERAL jsonb_array_elements_text(survivor.merged_source_ids)
                             WITH ORDINALITY AS m (source_id, position)
          JOIN places loser ON loser.source = 'overture' AND loser.source_id = m.source_id
                           AND loser.merged_into = survivor.id
          LEFT JOIN tmp_food_candidates c
                 ON c.source = loser.source AND c.source_id = loser.source_id
        ),
        names AS (
          SELECT cand_id,
                 (array_agg(name_en ORDER BY position)
                    FILTER (WHERE name_en IS NOT NULL))[1] AS name_en,
                 (array_agg(name_bn ORDER BY position)
                    FILTER (WHERE name_bn IS NOT NULL))[1] AS name_bn
          FROM merged GROUP BY cand_id
        ),
        contact AS (
          SELECT cand_id, jsonb_object_agg(key, value) AS tags
          FROM (
            SELECT DISTINCT ON (cand_id, key) cand_id, key, value
            FROM merged CROSS JOIN LATERAL jsonb_each(merged.tags)
            WHERE key = ANY (%s) AND value <> 'null'::jsonb
            ORDER BY cand_id, key, position
          ) first_value
          GROUP BY cand_id
        )
        UPDATE tmp_food_candidates s
        SET name_en = COALESCE(s.name_en, found.name_en),
            name_bn = COALESCE(s.name_bn, found.name_bn),
            tags    = COALESCE(found.tags, '{}'::jsonb) || s.tags
        FROM (SELECT * FROM names LEFT JOIN contact USING (cand_id)) found
        WHERE s.cand_id = found.cand_id
        """,
        (list(CONTACT_KEYS),),
    )


def conflate_osm_and_overture(cur: psycopg.Cursor[DictRow]) -> dict[str, int]:
    """Merges or queues each Overture row with its best OSM match: the most similar, then the
    nearest."""
    thresholds = {"merge": AUTO_MERGE_SIMILARITY, "review": REVIEW_SIMILARITY}
    # Materialised because merging deactivates rows that the matching reads. The thresholds are cast
    # to real, the type of similarity(), so that a score equal to a threshold reaches it.
    cur.execute(
        """
        CREATE TEMP TABLE tmp_food_matches ON COMMIT DROP AS
        WITH pairs AS (
          SELECT o.id AS osm_id, v.id AS ovt_id,
                 ST_Distance(o.geom::geography, v.geom::geography) AS dist_m,
                 GREATEST(
                   similarity(o.name_norm, v.name_norm),
                   similarity(o.name_roman, v.name_roman)
                 ) AS name_sim
          FROM places o
          JOIN places v
            ON v.overlay_type = 'food'
           AND v.source = 'overture'
           AND v.is_active
           AND o.district_id = v.district_id
           AND o.category = v.category
           AND o.geom && ST_Expand(v.geom, 0.001)
           AND ST_DWithin(o.geom::geography, v.geom::geography, 50)
          WHERE o.overlay_type = 'food'
            AND o.source = 'osm'
            AND o.is_active
        ),
        best AS (
          SELECT DISTINCT ON (ovt_id) *
          FROM pairs
          WHERE name_sim >= %(review)s::real
          ORDER BY ovt_id, name_sim DESC, dist_m, osm_id
        )
        SELECT *,
               name_sim >= %(merge)s::real AS auto_merge,
               row_number() OVER (ORDER BY name_sim DESC, dist_m, ovt_id) AS position
        FROM best
        """,
        thresholds,
    )
    # A survivor of several merges takes each missing value from the earliest one that has it.
    cur.execute(
        """
        WITH merged AS (
          SELECT m.osm_id, m.position, v.source_id, v.name_en, v.name_bn, v.tags
          FROM tmp_food_matches m
          JOIN places v ON v.id = m.ovt_id
          WHERE m.auto_merge
        ),
        survivor AS (
          SELECT osm_id,
                 array_agg(source_id ORDER BY position) AS source_ids,
                 (array_agg(name_en ORDER BY position)
                    FILTER (WHERE name_en IS NOT NULL))[1] AS name_en,
                 (array_agg(name_bn ORDER BY position)
                    FILTER (WHERE name_bn IS NOT NULL))[1] AS name_bn
          FROM merged GROUP BY osm_id
        ),
        contact AS (
          SELECT osm_id, jsonb_object_agg(key, value) AS tags
          FROM (
            SELECT DISTINCT ON (osm_id, key) osm_id, key, value
            FROM merged CROSS JOIN LATERAL jsonb_each(merged.tags)
            WHERE key = ANY (%s) AND value <> 'null'::jsonb
            ORDER BY osm_id, key, position
          ) first_value
          GROUP BY osm_id
        )
        UPDATE places p
        SET name_en = COALESCE(p.name_en, found.name_en),
            name_bn = COALESCE(p.name_bn, found.name_bn),
            merged_source_ids = p.merged_source_ids || COALESCE(
              (SELECT jsonb_agg(added.source_id ORDER BY added.position)
               FROM unnest(found.source_ids) WITH ORDINALITY AS added (source_id, position)
               WHERE NOT p.merged_source_ids ? added.source_id),
              '[]'::jsonb),
            tags = COALESCE(found.tags, '{}'::jsonb) || p.tags,
            updated_at = now()
        FROM (SELECT * FROM survivor LEFT JOIN contact USING (osm_id)) found
        WHERE p.id = found.osm_id
        """,
        (list(CONTACT_KEYS),),
    )
    cur.execute(
        """
        UPDATE places loser
        SET merged_into = m.osm_id, is_active = false, updated_at = now()
        FROM tmp_food_matches m
        WHERE loser.id = m.ovt_id AND m.auto_merge
        """
    )
    cur.execute(
        """
        INSERT INTO conflation_review_queue
          (primary_place_id, candidate_place_id, distance_m, name_similarity)
        SELECT osm_id, ovt_id, round(dist_m::numeric, 2), round(name_sim::numeric, 2)
        FROM tmp_food_matches
        WHERE NOT auto_merge
        ORDER BY position
        ON CONFLICT (primary_place_id, candidate_place_id) DO NOTHING
        """
    )
    # Counted from the matches: a pair that is already queued still counts.
    cur.execute(
        """
        SELECT COUNT(*) FILTER (WHERE auto_merge) AS auto_merged,
               COUNT(*) FILTER (WHERE NOT auto_merge) AS review_queued
        FROM tmp_food_matches
        """
    )
    (counts,) = cur.fetchall()
    return dict(counts)


def backfill_merged_into(conn: psycopg.Connection[Any]) -> int:
    """Recomputes survivor -> loser pairs from merged_source_ids (Slice 0B.8)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE places loser
            SET merged_into = pair.survivor_id, is_active = false, updated_at = now()
            FROM (
              SELECT DISTINCT ON (member.source_id) member.source_id, s.id AS survivor_id
              FROM places s
              CROSS JOIN LATERAL jsonb_array_elements_text(s.merged_source_ids)
                                 AS member (source_id)
              WHERE s.overlay_type = 'food' AND s.source = 'osm'
              ORDER BY member.source_id, s.is_active DESC, s.updated_at DESC, s.id
            ) pair
            WHERE loser.source = 'overture' AND loser.source_id = pair.source_id
              AND loser.merged_into IS NULL
            """
        )
        updated = cur.rowcount
    conn.commit()
    return updated
