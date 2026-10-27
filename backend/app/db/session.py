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

# Initialize SQLAlchemy engine with NullPool for transaction pooling (port 6543)
if DATABASE_URL:
    engine_kwargs = {}
    if not DATABASE_URL.startswith("sqlite"):
        engine_kwargs["poolclass"] = NullPool
    else:
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine = create_engine(
        DATABASE_URL,
        **engine_kwargs,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
else:
    engine = None
    SessionLocal = None

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
