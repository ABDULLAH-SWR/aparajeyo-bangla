"""Slice 1.9: no test reaches an external service by accident (Guide §7.1)."""

import httpx
import pytest
from respx.models import AllMockedAssertionError


def test_an_unmocked_external_call_fails_the_test():
    with pytest.raises(AllMockedAssertionError):
        httpx.get("https://www.googleapis.com/youtube/v3/search")
