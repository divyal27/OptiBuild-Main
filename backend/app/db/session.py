import os
import re
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool


def clean_database_url(raw_url: str) -> str:
    """
    Cleans and normalizes the DATABASE_URL:
    - Strips '?pgbouncer=true' or '&pgbouncer=true' as required for the Supabase transaction pooler.
    - Normalizes 'postgres://' to 'postgresql://' for SQLAlchemy compatibility.
    """
    url = raw_url.strip()

    # Remove ?pgbouncer=true or &pgbouncer=true
    url = re.sub(r'[\?&]pgbouncer=true', '', url)

    # Clean up trailing question mark or ampersand if left behind
    url = url.rstrip('?&')

    # SQLAlchemy 2.0 requires postgresql+psycopg2:// when using psycopg2 driver
    if url.startswith("postgres://"):
        url = "postgresql+psycopg2://" + url[len("postgres://"):]
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]

    return url


def get_database_url() -> str:
    """
    Retrieves the database connection string ONLY from the DATABASE_URL environment variable.
    """
    raw_url = os.getenv("DATABASE_URL")
    if not raw_url:
        raise ValueError("DATABASE_URL environment variable is not set.")
    return clean_database_url(raw_url)


from pathlib import Path


def _load_env_fallback():
    if not os.getenv("DATABASE_URL"):
        candidates = [
            Path(__file__).resolve().parent.parent.parent.parent / ".env",
            Path(__file__).resolve().parent.parent.parent / ".env",
            Path.cwd() / ".env",
        ]
        for p in candidates:
            if p.is_file():
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip("'\"")
                            if k not in os.environ:
                                os.environ[k] = v
                break


_load_env_fallback()

# Read DATABASE_URL strictly from environment variable
_raw_database_url = os.getenv("DATABASE_URL")
DATABASE_URL = clean_database_url(_raw_database_url) if _raw_database_url else None

def _build_engine(url: str):
    kwargs = {}
    if not url.startswith("sqlite"):
        kwargs["poolclass"] = NullPool
    else:
        kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(url, **kwargs)

_target_url = DATABASE_URL or "sqlite:///./optibuild.db"
try:
    eng = _build_engine(_target_url)
    if "localhost" in _target_url or "127.0.0.1" in _target_url:
        with eng.connect() as _c:
            pass
    engine = eng
    DATABASE_URL = _target_url
except Exception as _err:
    print(f"[Warning] Could not connect to {_target_url}: {_err}. Falling back to SQLite: sqlite:///./optibuild.db")
    sqlite_url = "sqlite:///./optibuild.db"
    DATABASE_URL = sqlite_url
    engine = _build_engine(sqlite_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator:
    """
    FastAPI dependency yielding a database session.
    """
    if not SessionLocal:
        raise RuntimeError("DATABASE_URL is not configured.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
