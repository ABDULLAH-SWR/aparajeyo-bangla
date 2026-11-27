from food_video_match.match_videos import match_segment


def place(place_id, match_key):
    return {"id": place_id, "norm_en": match_key, "norm_bn": "", "roman": ""}


def test_substring_inside_another_word_never_auto_approves():
    matches = match_segment(
        "Superstar Dhaka food tour",
        [place("p1", "star")],
        district_detected=True,
        chapter_line=False,
    )
    assert not [m for m in matches if m["confidence"] >= 0.85]


def test_short_name_with_whole_word_hit_stays_pending():
    matches = match_segment(
        "Nanna er biryani, Old Dhaka",
        [place("p1", "nanna")],
        district_detected=True,
        chapter_line=False,
    )
    assert [m["place_id"] for m in matches] == ["p1"]
    assert 0.50 <= matches[0]["confidence"] < 0.85


def test_long_name_with_whole_word_hit_auto_approves():
    matches = match_segment(
        "Nanna Biryani er khabar, Old Dhaka",
        [place("p1", "nanna biryani")],
        district_detected=True,
        chapter_line=False,
    )
    assert matches[0]["place_id"] == "p1"
    assert matches[0]["confidence"] >= 0.85
