import pytest
from starlette.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

ROLE_LOGINS = {
    "admin": ("admin@optibuild.io", "Admin@123"),
    "project_manager": ("pm@optibuild.io", "Pm@123"),
    "site_engineer": ("engineer@optibuild.io", "Engineer@123"),
    "store_keeper": ("store@optibuild.io", "Store@123"),
    "architect": ("architect@optibuild.io", "Architect@123"),
    "accountant": ("accountant@optibuild.io", "Accountant@123"),
    "owner": ("owner@optibuild.io", "Owner@123"),
}

_TOKEN_CACHE = {}


def auth_header(role: str) -> dict:
    if role not in _TOKEN_CACHE:
        email, password = ROLE_LOGINS[role]
        resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200, f"Login failed for {role}: {resp.text}"
        _TOKEN_CACHE[role] = resp.json()["access_token"]
    return {"Authorization": f"Bearer {_TOKEN_CACHE[role]}"}


def test_unauthenticated_request_rejected():
    """Endpoints requiring authentication return 401 when no token is provided."""
    resp = client.get("/api/v1/wbs/default-ratios")
    assert resp.status_code == 401


def test_admin_role_has_universal_access():
    """Admin role can access user management and project endpoints."""
    # User management (admin only)
    resp = client.get("/api/v1/users", headers=auth_header("admin"))
    assert resp.status_code == 200

    # WBS default ratios
    resp_wbs = client.get("/api/v1/wbs/default-ratios", headers=auth_header("admin"))
    assert resp_wbs.status_code == 200


def test_non_admin_cannot_access_user_management():
    """Non-admin roles are forbidden from managing users."""
    roles = ["project_manager", "site_engineer", "store_keeper", "architect", "accountant", "owner"]
    for r in roles:
        resp = client.get("/api/v1/users", headers=auth_header(r))
        assert resp.status_code == 403
        assert "Access denied" in resp.json()["detail"]


def test_project_manager_permissions():
    """Project Manager can access scheduler, optimizer, and WBS."""
    pm_headers = auth_header("project_manager")

    # WBS default ratios
    resp = client.get("/api/v1/wbs/default-ratios", headers=pm_headers)
    assert resp.status_code == 200

    # Optimizer evaluate endpoint
    payload = {
        "rera_params": {
            "total_allottee_investment": 10000000.0,
            "sbi_mclr_rate": 8.85,
            "rera_spread": 2.0,
            "delay_days": 10,
        },
        "tasks": [
            {
                "id": "T01",
                "name": "Columns",
                "normal_duration": 10,
                "crash_duration": 7,
                "normal_cost": 50000.0,
                "crash_cost": 80000.0,
                "predecessors": [],
            }
        ],
        "target_recovery_days": 3,
    }
    resp_opt = client.post("/api/v1/optimizer/evaluate", json=payload, headers=pm_headers)
    assert resp_opt.status_code == 200


import uuid
from backend.app.db.session import SessionLocal
from backend.app.db.models import Project, ProjectMember, User, TaskModel


def _setup_roles_test_project():
    db = SessionLocal()
    try:
        pm = db.query(User).filter(User.email == "pm@optibuild.io").first()
        proj = db.query(Project).filter(Project.id == "roles-test-project").first()
        if not proj:
            proj = Project(
                id="roles-test-project",
                name="Roles Test Project",
                created_by_id=pm.id if pm else None,
                total_project_cost=10000000.0,
            )
            db.add(proj)
            db.commit()

        task = db.query(TaskModel).filter(TaskModel.project_id == "roles-test-project", TaskModel.id == "T01").first()
        if not task:
            task = TaskModel(
                id="T01",
                project_id="roles-test-project",
                name="Foundation Excavation",
                duration=10,
                normal_cost=50000.0,
                crash_cost=80000.0,
                crash_duration=7,
                progress_percent=0.0,
                status="NOT_STARTED",
            )
            db.add(task)
            db.commit()

        assignments = [
            ("store@optibuild.io", "store_keeper"),
            ("accountant@optibuild.io", "accountant"),
            ("owner@optibuild.io", "owner"),
            ("engineer@optibuild.io", "site_engineer"),
            ("architect@optibuild.io", "architect"),
        ]
        for email, role in assignments:
            u = db.query(User).filter(User.email == email).first()
            if u:
                m = db.query(ProjectMember).filter(
                    ProjectMember.project_id == "roles-test-project",
                    ProjectMember.user_id == u.id,
                ).first()
                if not m:
                    db.add(ProjectMember(project_id="roles-test-project", user_id=u.id, role=role))
        db.commit()
        return "roles-test-project"
    finally:
        db.close()


def test_store_keeper_can_log_materials_others_cannot():
    """Store keeper can create material logs; architect and owner cannot."""
    proj_id = _setup_roles_test_project()
    material_payload = {
        "project_id": proj_id,
        "date": "2026-10-25",
        "material_category": "Cement",
        "item_description": "53 Grade OPC Bags",
        "quantity": 100.0,
        "unit": "Bags",
        "unit_rate": 380.0,
        "vendor_name": "UltraTech Depot",
        "invoice_number": "INV-TEST-001",
    }

    # Store Keeper -> PASS
    resp_store = client.post("/api/v1/materials/log", json=material_payload, headers=auth_header("store_keeper"))
    assert resp_store.status_code == 200

    # Architect -> 403 Forbidden
    resp_arch = client.post("/api/v1/materials/log", json=material_payload, headers=auth_header("architect"))
    assert resp_arch.status_code == 403

    # Owner -> 403 Forbidden
    resp_owner = client.post("/api/v1/materials/log", json=material_payload, headers=auth_header("owner"))
    assert resp_owner.status_code == 403


def test_architect_drawing_permissions():
    """Architect can upload drawings; store keeper and site engineer cannot."""
    files = {"file": ("floor_plan.pdf", b"%PDF-1.4 mock cad content", "application/pdf")}
    data = {"title": "L14 Floor Plan", "drawing_type": "ARCHITECTURAL"}

    # Store keeper -> 403
    resp_store = client.post(
        "/api/v1/projects/fake-id/drawings",
        files=files,
        data=data,
        headers=auth_header("store_keeper"),
    )
    assert resp_store.status_code == 403

    # Site engineer -> 403
    resp_eng = client.post(
        "/api/v1/projects/fake-id/drawings",
        files=files,
        data=data,
        headers=auth_header("site_engineer"),
    )
    assert resp_eng.status_code == 403


def test_accountant_and_owner_read_dashboard():
    """Accountant and Owner can read Budget vs Actual dashboard."""
    proj_id = _setup_roles_test_project()
    for role in ["accountant", "owner", "admin", "project_manager"]:
        resp = client.get(f"/api/v1/dashboard/budget-vs-actual?project_id={proj_id}", headers=auth_header(role))
        assert resp.status_code == 200

    # Architect -> 403
    resp_arch = client.get(f"/api/v1/dashboard/budget-vs-actual?project_id={proj_id}", headers=auth_header("architect"))
    assert resp_arch.status_code == 403


def test_unassigned_user_cannot_read_or_write_project_data():
    """A user not assigned to a project cannot read or write its data (returns 403)."""
    db = SessionLocal()
    try:
        pm = db.query(User).filter(User.email == "pm@optibuild.io").first()
        proj_id = f"private-proj-{uuid.uuid4().hex[:8]}"
        proj = Project(id=proj_id, name="Private Project", created_by_id=pm.id)
        db.add(proj)
        db.commit()
    finally:
        db.close()

    # Engineer is not assigned to proj_id -> 403 on reads & writes
    assert client.get(f"/api/v1/projects/{proj_id}", headers=auth_header("site_engineer")).status_code == 403
    assert client.get(f"/api/v1/projects/{proj_id}/drawings", headers=auth_header("site_engineer")).status_code == 403
    assert client.get(f"/api/v1/projects/{proj_id}/photos", headers=auth_header("site_engineer")).status_code == 403
    assert client.get(f"/api/v1/materials/log?project_id={proj_id}", headers=auth_header("site_engineer")).status_code == 403
    assert client.get(f"/api/v1/dashboard/budget-vs-actual?project_id={proj_id}", headers=auth_header("site_engineer")).status_code == 403

    # Architect is not assigned to proj_id -> 403 on reads & writes
    assert client.get(f"/api/v1/projects/{proj_id}", headers=auth_header("architect")).status_code == 403
    resp_draw = client.post(
        f"/api/v1/projects/{proj_id}/drawings",
        files={"file": ("plan.pdf", b"%PDF-1.4 mock", "application/pdf")},
        data={"title": "Floor Plan", "drawing_type": "ARCHITECTURAL"},
        headers=auth_header("architect"),
    )
    assert resp_draw.status_code == 403

    # Store keeper not assigned -> 403 on materials write
    mat_payload = {
        "project_id": proj_id,
        "date": "2026-10-25",
        "material_category": "Cement",
        "item_description": "OPC Bags",
        "quantity": 10.0,
        "unit": "Bags",
        "unit_rate": 350.0,
        "vendor_name": "Supplier",
        "invoice_number": "INV-001",
    }
    assert client.post("/api/v1/materials/log", json=mat_payload, headers=auth_header("store_keeper")).status_code == 403


def test_assigned_site_engineer_can_upload_photos_but_cannot_run_scheduler():
    """An assigned site_engineer can upload photos but cannot run the scheduler (returns 403)."""
    proj_id = _setup_roles_test_project()
    eng_headers = auth_header("site_engineer")

    # Can upload photos -> 200
    files = {"file": ("site_photo.jpg", b"\xff\xd8\xff\xe0 mock jpeg bytes", "image/jpeg")}
    resp_photo = client.post(
        f"/api/v1/projects/{proj_id}/photos",
        files=files,
        data={"notes": "Foundation works underway"},
        headers=eng_headers,
    )
    assert resp_photo.status_code == 200

    # Cannot run scheduler -> 403
    resp_sched = client.post(
        f"/api/v1/projects/{proj_id}/schedule",
        json={"ga_population_size": 20, "ga_generations": 20},
        headers=eng_headers,
    )
    assert resp_sched.status_code == 403
    assert "Access denied" in resp_sched.json()["detail"]


def test_assigned_architect_can_only_attach_drawings():
    """An architect can attach drawings but cannot upload photos or run scheduler."""
    proj_id = _setup_roles_test_project()
    arch_headers = auth_header("architect")

    # Can attach drawings -> 200
    files = {"file": ("elevations.pdf", b"%PDF-1.4 mock cad content", "application/pdf")}
    resp_draw = client.post(
        f"/api/v1/projects/{proj_id}/drawings",
        files=files,
        data={"title": "North Elevation", "drawing_type": "ARCHITECTURAL"},
        headers=arch_headers,
    )
    assert resp_draw.status_code == 200

    # Cannot upload site photos -> 403
    photo_files = {"file": ("snap.jpg", b"\xff\xd8\xff\xe0 mock", "image/jpeg")}
    resp_photo = client.post(
        f"/api/v1/projects/{proj_id}/photos",
        files=photo_files,
        headers=arch_headers,
    )
    assert resp_photo.status_code == 403

    # Cannot run scheduler -> 403
    resp_sched = client.post(
        f"/api/v1/projects/{proj_id}/schedule",
        json={},
        headers=arch_headers,
    )
    assert resp_sched.status_code == 403


def test_list_projects_non_admin_returns_empty_when_no_memberships():
    """Non-admin user with no memberships receives an empty list, not all projects."""
    db = SessionLocal()
    try:
        fresh_user = db.query(User).filter(User.email == "isolated@optibuild.io").first()
        if not fresh_user:
            from backend.app.core.auth import hash_password
            fresh_user = User(
                id=f"user-{uuid.uuid4().hex[:8]}",
                email="isolated@optibuild.io",
                hashed_password=hash_password("Isolated@123"),
                full_name="Isolated User",
                role="site_engineer",
                is_active=True,
            )
            db.add(fresh_user)
            db.commit()
    finally:
        db.close()

    login_resp = client.post("/api/v1/auth/login", json={"email": "isolated@optibuild.io", "password": "Isolated@123"})
    assert login_resp.status_code == 200
    iso_token = login_resp.json()["access_token"]

    resp = client.get("/api/v1/projects", headers={"Authorization": f"Bearer {iso_token}"})
    assert resp.status_code == 200
    assert resp.json() == []

    me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {iso_token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["projects"] == []
