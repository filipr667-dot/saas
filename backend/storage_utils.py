import os
import uuid
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

UPLOADS_DIR = Path(os.environ.get("UPLOADS_DIR", "./uploads"))


def init_storage():
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    return str(UPLOADS_DIR)


def put_object(path: str, data: bytes, content_type: str) -> dict:
    init_storage()
    full_path = UPLOADS_DIR / path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(data)
    (full_path.parent / (full_path.name + ".ct")).write_text(content_type)
    return {"path": path}


def get_object(path: str) -> tuple:
    init_storage()
    full_path = UPLOADS_DIR / path
    if not full_path.exists():
        raise FileNotFoundError(f"File not found: {path}")
    data = full_path.read_bytes()
    ct_file = full_path.parent / (full_path.name + ".ct")
    content_type = ct_file.read_text() if ct_file.exists() else "application/octet-stream"
    return data, content_type


def generate_storage_path(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    return f"documents/{uuid.uuid4()}.{ext}"
