"""Slice 0D.7: generic suffixes are stripped after normalization."""

from food_shared.bangla_norm import normalize_bangla, strip_generic_suffixes

# রেস্তোরাঁ with the vowel sign O typed as its two halves (U+09C7 U+09BE instead of U+09CB).
DECOMPOSED_RESTAURANT = "রেস্তোরাঁ"


def test_a_decomposed_form_of_a_generic_suffix_is_removed():
    name = f"স্টার {DECOMPOSED_RESTAURANT}"

    assert strip_generic_suffixes(normalize_bangla(name)) == "স্টার"
