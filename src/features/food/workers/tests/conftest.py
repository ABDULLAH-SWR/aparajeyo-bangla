"""Tests are an entry point too: unset variables come from the local env files."""

from food_shared.config import load_env_files

load_env_files()
