class PhotoRejected(Exception):
    """A candidate that may never be mirrored as it is. Not a failure: retrying cannot help."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason
