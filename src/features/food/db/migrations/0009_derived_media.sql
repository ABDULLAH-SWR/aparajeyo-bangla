-- migrate:up
CREATE OR REPLACE FUNCTION food_rebuild_place_media(p_ids uuid[])
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH computed AS (
    SELECT p.id,
           COALESCE((SELECT jsonb_agg(ph.s3_key ORDER BY ph.sort_order, ph.id)
                     FROM place_photos ph WHERE ph.place_id = p.id), '[]'::jsonb) AS s3_keys,
           COALESCE((SELECT array_agg(m.video_id ORDER BY m.confidence DESC, v.published_at DESC, m.video_id)
                     FROM video_place_matches m
                     JOIN youtube_videos v ON v.video_id = m.video_id
                     WHERE m.place_id = p.id
                       AND m.status IN ('auto_approved', 'approved')
                       AND v.is_available), '{}'::text[]) AS video_ids
    FROM places p
    WHERE p.id = ANY (p_ids)
  ), updated AS (
    UPDATE places p
    SET wikimedia_s3_keys = c.s3_keys,
        youtube_video_ids = c.video_ids,
        updated_at        = now()
    FROM computed c
    WHERE p.id = c.id
      AND (p.wikimedia_s3_keys IS DISTINCT FROM c.s3_keys
           OR p.youtube_video_ids IS DISTINCT FROM c.video_ids)
    RETURNING 1
  )
  SELECT count(*)::integer FROM updated;
$$;
REVOKE ALL ON FUNCTION food_rebuild_place_media(uuid[]) FROM PUBLIC;

-- Shared by place_photos and video_place_matches (both carry place_id).
CREATE OR REPLACE FUNCTION food_trg_rebuild_by_place_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM food_rebuild_place_media(ARRAY(SELECT DISTINCT place_id FROM new_rows));
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM food_rebuild_place_media(ARRAY(SELECT DISTINCT place_id FROM old_rows));
  ELSE
    PERFORM food_rebuild_place_media(ARRAY(SELECT place_id FROM new_rows UNION SELECT place_id FROM old_rows));
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER place_photos_rebuild_ins AFTER INSERT ON place_photos
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION food_trg_rebuild_by_place_id();
CREATE TRIGGER place_photos_rebuild_upd AFTER UPDATE ON place_photos
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION food_trg_rebuild_by_place_id();
CREATE TRIGGER place_photos_rebuild_del AFTER DELETE ON place_photos
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION food_trg_rebuild_by_place_id();

CREATE TRIGGER vpm_rebuild_ins AFTER INSERT ON video_place_matches
  REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION food_trg_rebuild_by_place_id();
CREATE TRIGGER vpm_rebuild_upd AFTER UPDATE ON video_place_matches
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION food_trg_rebuild_by_place_id();
CREATE TRIGGER vpm_rebuild_del AFTER DELETE ON video_place_matches
  REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION food_trg_rebuild_by_place_id();

CREATE OR REPLACE FUNCTION food_trg_videos_rebuild()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM food_rebuild_place_media(ARRAY(
    SELECT DISTINCT m.place_id
    FROM new_rows n
    JOIN old_rows o ON o.video_id = n.video_id
    JOIN video_place_matches m ON m.video_id = n.video_id
    WHERE n.is_available IS DISTINCT FROM o.is_available
       OR n.published_at IS DISTINCT FROM o.published_at));
  RETURN NULL;
END $$;
CREATE TRIGGER youtube_videos_rebuild_upd AFTER UPDATE ON youtube_videos
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION food_trg_videos_rebuild();

-- Editor overrides advance updated_at (column privileges are checked only for columns named in the UPDATE).
CREATE OR REPLACE FUNCTION food_trg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER places_touch_overrides
  BEFORE UPDATE OF name_en_override, name_bn_override, geom_override, is_hidden, is_featured ON places
  -- Only the override columns are compared: a BEFORE trigger's WHEN cannot read NEW.*, which
  -- includes the generated eff_* columns.
  FOR EACH ROW WHEN (
    (OLD.name_en_override, OLD.name_bn_override, OLD.geom_override, OLD.is_hidden, OLD.is_featured)
    IS DISTINCT FROM
    (NEW.name_en_override, NEW.name_bn_override, NEW.geom_override, NEW.is_hidden, NEW.is_featured)
  ) EXECUTE FUNCTION food_trg_touch_updated_at();

-- One-time reconciliation of the diverged arrays (audit M1 :43-44).
SELECT food_rebuild_place_media(ARRAY(SELECT id FROM places WHERE overlay_type = 'food'));

-- migrate:down
DROP TRIGGER places_touch_overrides ON places;
DROP FUNCTION food_trg_touch_updated_at();
DROP TRIGGER youtube_videos_rebuild_upd ON youtube_videos;
DROP FUNCTION food_trg_videos_rebuild();
DROP TRIGGER vpm_rebuild_del ON video_place_matches;
DROP TRIGGER vpm_rebuild_upd ON video_place_matches;
DROP TRIGGER vpm_rebuild_ins ON video_place_matches;
DROP TRIGGER place_photos_rebuild_del ON place_photos;
DROP TRIGGER place_photos_rebuild_upd ON place_photos;
DROP TRIGGER place_photos_rebuild_ins ON place_photos;
DROP FUNCTION food_trg_rebuild_by_place_id();
DROP FUNCTION food_rebuild_place_media(uuid[]);
