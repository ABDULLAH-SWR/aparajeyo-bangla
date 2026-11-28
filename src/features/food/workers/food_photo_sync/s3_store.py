"""The object store port of the media pipeline, and its Garage (S3 API) implementation."""

from __future__ import annotations

from typing import Protocol

import boto3
from botocore.config import Config


class S3Store(Protocol):
    def put(self, key: str, body: bytes, content_type: str) -> None:
        """Stores the object, or raises."""
        ...

    def delete(self, key: str) -> None:
        """Removes the object. Removing a missing object is not an error."""
        ...


class GarageS3Store:
    def __init__(
        self, *, endpoint: str, region: str, bucket: str, access_key: str, secret_key: str
    ) -> None:
        self._bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(
                s3={"addressing_style": "path"},
                # boto3 >= 1.36 adds checksums by default, which not every S3 server accepts.
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
        )

    def put(self, key: str, body: bytes, content_type: str) -> None:
        self._client.put_object(Bucket=self._bucket, Key=key, Body=body, ContentType=content_type)

    def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self._bucket, Key=key)
