import os
import re
import uuid
from pathlib import Path
from typing import Optional
import boto3
from fastapi import HTTPException, status
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
HTTP_413 = getattr(status, "HTTP_413_CONTENT_TOO_LARGE", 413)


def sanitize_filename(filename: str) -> str:
    """
    Sanitizes filename by stripping directory path separators,
    limiting character set to safe alphanumerics, dots, hyphens, and underscores,
    and limiting maximum length to 100 characters.
    """
    # Normalize backslashes to forward slashes for cross-platform directory stripping
    normalized = filename.replace("\\", "/")
    base = Path(normalized).name
    sanitized = re.sub(r'[^a-zA-Z0-9._-]', '_', base)
    sanitized = sanitized.strip('. ')
    if not sanitized:
        sanitized = "file"
    if len(sanitized) > 100:
        ext = Path(sanitized).suffix
        stem = Path(sanitized).stem[:100 - len(ext)]
        sanitized = f"{stem}{ext}"
    return sanitized


def validate_file_content(category_type: str, content: bytes, filename: str):
    """
    Validates file upload content by size limits and magic bytes:
    - MahaRERA PDF only: 10 MB max, magic bytes '%PDF-'
    - Site photos & Bill photos: 5 MB max, JPEG / PNG / WebP only
    - Architect drawings: 20 MB max, PDF / DWG / JPEG / PNG / WebP only
    Raises 400 for invalid file type, 413 for size limit exceeded.
    """
    size = len(content)

    if category_type == "maharera":
        if size > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=HTTP_413,
                detail=f"MahaRERA PDF exceeds maximum limit of 10 MB (received {size / (1024*1024):.2f} MB).",
            )
        if not content.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file content. Expected a valid PDF document (magic bytes '%PDF-' missing).",
            )

    elif category_type in ("site_photo", "bill_photo"):
        if size > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=HTTP_413,
                detail=f"Image exceeds maximum limit of 5 MB (received {size / (1024*1024):.2f} MB).",
            )
        is_jpeg = content.startswith(b"\xff\xd8\xff")
        is_png = content.startswith(b"\x89PNG\r\n\x1a\n")
        is_webp = len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
        if not (is_jpeg or is_png or is_webp):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file content. Only JPEG, PNG, and WebP images are allowed for photos.",
            )

    elif category_type == "architect_drawing":
        if size > 20 * 1024 * 1024:
            raise HTTPException(
                status_code=HTTP_413,
                detail=f"Architectural drawing exceeds maximum limit of 20 MB (received {size / (1024*1024):.2f} MB).",
            )
        is_pdf = content.startswith(b"%PDF-")
        is_dwg = content.startswith(b"AC10") or filename.lower().endswith(".dwg")
        is_jpeg = content.startswith(b"\xff\xd8\xff")
        is_png = content.startswith(b"\x89PNG\r\n\x1a\n")
        is_webp = len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP"
        if not (is_pdf or is_dwg or is_jpeg or is_png or is_webp):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file content. Architectural drawings must be PDF, DWG, or images (JPEG, PNG, WebP).",
            )


class S3StorageManager:
    """
    S3-compatible object storage abstraction supporting Cloudflare R2, AWS S3, and MinIO,
    with local disk fallback when cloud S3 credentials are not configured or network fails.
    LOCKED RULES ENFORCEMENT:
    - Architect files: attach-only, stored for human viewing, NEVER parsed.
    - Bill photos: stored as unparsed documentary evidence only.
    """

    def __init__(self):
        self.endpoint_url = os.getenv("S3_ENDPOINT_URL", "http://localhost:9000")
        self.access_key = os.getenv("S3_ACCESS_KEY", "mock_access_key")
        self.secret_key = os.getenv("S3_SECRET_KEY", "mock_secret_key")
        self.bucket_name = os.getenv("S3_BUCKET_NAME", "optibuild-artifacts")
        self.region = os.getenv("S3_REGION", "ap-south-1")

        try:
            self.client = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region,
            )
        except Exception:
            self.client = None

    def check_project_quota(self, project_id: str, new_bytes: int):
        max_mb = float(os.getenv("MAX_PROJECT_STORAGE_MB", "200"))
        max_bytes = max_mb * 1024 * 1024

        current_bytes = self.get_project_storage_bytes(project_id)
        if current_bytes + new_bytes > max_bytes:
            raise HTTPException(
                status_code=HTTP_413,
                detail=f"Project storage limit exceeded. Project '{project_id}' currently uses {current_bytes / (1024*1024):.2f} MB. "
                       f"Uploading this file would exceed the project quota of {max_mb:.0f} MB.",
            )

    def get_project_storage_bytes(self, project_id: str) -> int:
        if not project_id or project_id in ("general", "temp", "incoming"):
            return 0
        total_size = 0
        if self.client:
            try:
                paginator = self.client.get_paginator("list_objects_v2")
                pages = paginator.paginate(Bucket=self.bucket_name, Prefix=f"{project_id}/")
                for page in pages:
                    for obj in page.get("Contents", []):
                        total_size += obj.get("Size", 0)
                return total_size
            except Exception:
                pass

        proj_dir = UPLOAD_DIR / project_id
        if proj_dir.exists():
            for p in proj_dir.rglob("*"):
                if p.is_file():
                    total_size += p.stat().st_size
        return total_size

    def generate_presigned_download_url(self, key: str, expires_in: int = 600) -> str:
        """Generates a short-lived signed download URL (default 10 minutes = 600s)."""
        if self.client:
            try:
                return self.client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": self.bucket_name, "Key": key},
                    ExpiresIn=expires_in,
                )
            except Exception:
                pass
        return f"/uploads/{key}"

    def get_download_url(self, stored_path_or_key: str, expires_in: int = 600) -> str:
        """Extracts the storage key and returns a fresh signed download URL."""
        if not stored_path_or_key:
            return ""
        key = stored_path_or_key
        if f"/{self.bucket_name}/" in key:
            key = key.split(f"/{self.bucket_name}/", 1)[1].split("?", 1)[0]
        elif "/uploads/" in key:
            key = key.split("/uploads/", 1)[1]
        return self.generate_presigned_download_url(key, expires_in=expires_in)

    def _save_local_fallback(self, file_bytes: bytes, key: str) -> str:
        target_path = UPLOAD_DIR / key
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(file_bytes)
        return f"/uploads/{key}"

    def upload_file(
        self,
        file_bytes: bytes,
        category: str,
        file_name: str,
        project_id: str = "general",
        metadata: Optional[dict] = None,
    ) -> str:
        safe_name = sanitize_filename(file_name)
        file_uuid = uuid.uuid4().hex
        key = f"{project_id}/{category}/{file_uuid}_{safe_name}"

        if self.client:
            try:
                kwargs = {
                    "Bucket": self.bucket_name,
                    "Key": key,
                    "Body": file_bytes,
                }
                if metadata:
                    kwargs["Metadata"] = metadata
                self.client.put_object(**kwargs)
                return self.generate_presigned_download_url(key)
            except Exception:
                pass

        self._save_local_fallback(file_bytes, key)
        return f"/uploads/{key}"

    def upload_architect_drawing(self, file_bytes: bytes, file_name: str, project_id: str = "general") -> str:
        """
        Stores an architectural CAD/PDF drawing for human viewing only.
        LOCKED RULE: Never parse or OCR architectural drawings.
        """
        validate_file_content("architect_drawing", file_bytes, file_name)
        self.check_project_quota(project_id, len(file_bytes))
        return self.upload_file(
            file_bytes=file_bytes,
            category="architect_drawings",
            file_name=file_name,
            project_id=project_id,
            metadata={"type": "architect_drawing_attach_only", "unparsed": "true"},
        )

    def upload_bill_evidence(self, file_bytes: bytes, file_name: str, project_id: str = "general") -> str:
        """
        Stores material invoice receipt photo as unparsed evidence.
        LOCKED RULE: Bill photos are stored as unparsed evidence only.
        """
        validate_file_content("bill_photo", file_bytes, file_name)
        self.check_project_quota(project_id, len(file_bytes))
        return self.upload_file(
            file_bytes=file_bytes,
            category="bill_evidence",
            file_name=file_name,
            project_id=project_id,
            metadata={"type": "unparsed_bill_evidence", "unparsed": "true"},
        )

    def upload_rera_pdf(self, file_bytes: bytes, file_name: str, project_id: str = "general") -> str:
        """
        Stores original MahaRERA certificate PDF.
        """
        validate_file_content("maharera", file_bytes, file_name)
        self.check_project_quota(project_id, len(file_bytes))
        return self.upload_file(
            file_bytes=file_bytes,
            category="rera_certificates",
            file_name=file_name,
            project_id=project_id,
            metadata={"type": "maharera_certificate_raw"},
        )

    def upload_site_photo(self, file_bytes: bytes, file_name: str, project_id: str = "general") -> str:
        """
        Stores site photo for progress tracking.
        """
        validate_file_content("site_photo", file_bytes, file_name)
        self.check_project_quota(project_id, len(file_bytes))
        return self.upload_file(
            file_bytes=file_bytes,
            category="site_photos",
            file_name=file_name,
            project_id=project_id,
            metadata={"type": "site_photo"},
        )


storage = S3StorageManager()
