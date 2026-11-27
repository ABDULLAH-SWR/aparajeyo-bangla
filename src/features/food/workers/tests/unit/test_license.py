import pytest

from food_photo_sync.license import is_allowed_license


@pytest.mark.parametrize(
    ("short_name", "non_free_flag", "expected"),
    [
        ("CC BY-NC 4.0", None, False),
        ("CC BY-ND 4.0", None, False),
        ("CC BY-NC-SA 4.0", None, False),
        ("CC BY-SA 4.0", None, True),
        ("CC BY 2.0", None, True),
        ("CC0", None, True),
        ("CC0 1.0", None, True),
        ("Public domain", None, True),
        ("CC BY-SA 3.0 de", None, True),
        ("CC BY-SA 4.0", "true", False),
    ],
)
def test_is_allowed_license(short_name, non_free_flag, expected):
    assert is_allowed_license(short_name, non_free_flag) is expected
