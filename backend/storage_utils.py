import os
import uuid
import logging
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

_s3_client = None
_bucket = None
_use_r2 = False

UPLOADS_DIR = Path(os.environ.get("UPLOADS_DIR", "./uploads"))


def init_storage():
    global _s3_client, _bucket, _use_r2

    endpoint = os.environ.get("R2_ENDPOINT")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    bucket_name = os.environ.get("R2_BUCKET_NAME")

    if all([endpoint, access_key, secret_key, bucket_name]):
        _s3_client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
        )
        _bucket = bucket_name
        _use_r2 = True
        logger.info(f"Storage: Cloudflare R2 bucket '{_bucket}'")
    else:
        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        _use_r2 = False
        logger.info(f"Storage: local disk at {UPLOADS_DIR} (set R2_* env vars for cloud storage)")

    return "r2" if _use_r2 else str(UPLOADS_DIR)


def put_object(path: str, data: bytes, content_type: str) -> dict:
    if _use_r2:
        _s3_client.put_object(
            Bucket=_bucket,
            Key=path,
            Body=data,
            ContentType=content_type,
        )
        return {"path": path}

    full_path = UPLOADS_DIR / path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(data)
    (full_path.parent / (full_path.name + ".ct")).write_text(content_type)
    return {"path": path}


def get_object(path: str) -> tuple:
    if _use_r2:
        try:
            resp = _s3_client.get_object(Bucket=_bucket, Key=path)
            data = resp["Body"].read()
            content_type = resp.get("ContentType", "application/octet-stream")
            return data, content_type
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                raise FileNotFoundError(f"File not found in R2: {path}")
            raise

    full_path = UPLOADS_DIR / path
    if not full_path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    data = full_path.read_bytes()
    ct_file = full_path.parent / (full_path.name + ".ct")
    content_type = ct_file.read_text() if ct_file.exists() else "application/octet-stream"
    return data, content_type


def delete_object(path: str):
    if _use_r2:
        _s3_client.delete_object(Bucket=_bucket, Key=path)
        return

    full_path = UPLOADS_DIR / path
    if full_path.exists():
        full_path.unlink()
    ct_file = full_path.parent / (full_path.name + ".ct")
    if ct_file.exists():
        ct_file.unlink()


def generate_storage_path(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    return f"documents/{uuid.uuid4()}.{ext}"
