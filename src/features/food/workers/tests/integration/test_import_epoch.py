"""Slice 0D.5: an import that changes places invalidates the API cache."""

from importing import import_sources


def test_the_epoch_rises_by_one_for_a_changing_run_and_not_for_an_identical_rerun(import_db):
    import_db.valkey.set("food:epoch", 7)

    import_sources(import_db)
    assert import_db.valkey.get("food:epoch") == "8"

    import_sources(import_db)
    assert import_db.valkey.get("food:epoch") == "8"
