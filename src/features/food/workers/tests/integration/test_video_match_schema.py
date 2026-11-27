"""food_video_match against the migrated schema."""

from food_video_match.match_videos import run_matching


def seed_video(db, video_id: str, title: str) -> None:
    db.conn.execute(
        "INSERT INTO youtube_channels (channel_id, uploads_playlist_id, title, overlay_type)"
        " VALUES ('UCtest', 'UUtest', 'Test Channel', 'food')"
    )
    db.conn.execute(
        "INSERT INTO youtube_videos"
        " (video_id, channel_id, title, published_at, duration_seconds, last_verified_at)"
        " VALUES (%s, 'UCtest', %s, now(), 600, now())",
        (video_id, title),
    )


def test_auto_approved_match_is_stored_unreviewed(food_db, monkeypatch, tmp_path):
    geo = tmp_path / "geo_codes.json"
    geo.write_text('{"districts": [], "upazilas": []}', encoding="utf-8")
    monkeypatch.setenv("GEO_CODES_PATH", str(geo))
    food_db.migrate()
    food_db.seed_geo()
    food_db.insert_place(name_en="Sultans Dine", name_norm="sultans dine")
    seed_video(food_db, "vid1", "Sultans Dine Dhanmondi")

    run_matching()

    row = food_db.conn.execute(
        "SELECT status, reviewed_at, reviewed_by FROM video_place_matches"
    ).fetchone()
    assert row == {"status": "auto_approved", "reviewed_at": None, "reviewed_by": None}
    place = food_db.conn.execute("SELECT youtube_video_ids AS ids FROM places").fetchone()
    assert place == {"ids": ["vid1"]}
