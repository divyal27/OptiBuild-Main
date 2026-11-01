import os
import sys
from pathlib import Path

# Ensure repository root is on sys.path for direct pytest invocation
_REPO_ROOT = str(Path(__file__).resolve().parents[2])
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

# Ensure test JWT_SECRET is set before importing app or config
if "JWT_SECRET" not in os.environ or len(os.environ.get("JWT_SECRET", "").strip()) < 32:
    os.environ["JWT_SECRET"] = "test-secret-at-least-32-chars-for-optibuild-tests"

import pytest
from backend.app.main import app
from backend.app.core.auth import get_current_user
from backend.app.db.session import SessionLocal
from backend.app.db.models import User


@pytest.fixture(autouse=True)
def auto_auth(request):
    """
    Automatically authenticates API calls with the seeded Admin user for endpoint logic tests,
    while leaving test_auth.py and test_roles.py to test raw authentication mechanics.
    """
    fspath_str = str(request.node.fspath)
    if "test_auth" in fspath_str or "test_roles" in fspath_str:
        yield
        return

    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.email == "admin@optibuild.io").first()
        if not admin_user:
            admin_user = User(
                email="admin@optibuild.io",
                full_name="System Administrator",
                role="admin",
                is_active=True,
                hashed_password="mock",
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
    finally:
        db.close()

    app.dependency_overrides[get_current_user] = lambda: admin_user
    yield
    app.dependency_overrides.pop(get_current_user, None)
