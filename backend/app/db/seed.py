import sys
from pathlib import Path
from datetime import datetime

repo_root = Path(__file__).resolve().parent.parent.parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from backend.app.db.session import SessionLocal
from backend.app.db.models import (
    User,
    Organization,
    Project,
    ProjectMember,
    TaskModel,
    MaterialLogModel,
    RERACertificateModel,
    DelayRecoveryEvaluationModel,
)
from backend.app.core.auth import hash_password
from backend.app.schemas.wbs import BuildingParametersInput
from backend.app.engine.wbs_generator import WBSGenerator
from backend.app.schemas.schedule import TaskInputItem
from backend.app.engine.cpm import CPMEngine
from backend.app.engine.ga import RCPSPGeneticAlgorithm
from backend.app.schemas.optimizer import RERAPenaltyParams, CrashableTaskItem
from backend.app.engine.optimizer import DelayRecoveryOptimizer

DEMO_USERS = [
    {
        "email": "admin@optibuild.io",
        "password": "Admin@123",
        "full_name": "System Administrator",
        "role": "admin",
    },
    {
        "email": "pm@optibuild.io",
        "password": "Pm@123",
        "full_name": "Rajesh Sharma (Project Manager)",
        "role": "project_manager",
    },
    {
        "email": "engineer@optibuild.io",
        "password": "Engineer@123",
        "full_name": "Amit Patil (Site Engineer)",
        "role": "site_engineer",
    },
    {
        "email": "site@optibuild.io",
        "password": "Site@123",
        "full_name": "Amit Patil (Site Engineer)",
        "role": "site_engineer",
    },
    {
        "email": "store@optibuild.io",
        "password": "Store@123",
        "full_name": "Suresh Deshmukh (Store Keeper)",
        "role": "store_keeper",
    },
    {
        "email": "architect@optibuild.io",
        "password": "Architect@123",
        "full_name": "Pooja Kulkarni (Lead Architect)",
        "role": "architect",
    },
    {
        "email": "accountant@optibuild.io",
        "password": "Accountant@123",
        "full_name": "Vikas Joshi (Project Accountant)",
        "role": "accountant",
    },
    {
        "email": "owner@optibuild.io",
        "password": "Owner@123",
        "full_name": "Anand Singhania (Owner / Developer)",
        "role": "owner",
    },
]

DEMO_ORGANIZATION_NAME = "OptiBuild Infrastructure Corp"
FLAGSHIP_PROJECT_ID = "emerald-heights-ph2"


def seed_flagship_project(db, org, users_map):
    """
    Seeds a complete, boardroom-ready flagship showcase project:
    'Emerald Heights Phase 2 (Tower A & B)' with all 7 RBAC roles assigned,
    complete 6-package WBS, CPM critical path flags, RCPSP GA schedule,
    MahaRERA Section 18 delay penalty vs crash optimizer evaluation,
    actual material log receipts, and explicit DPDP Act 2023 training consent.
    """
    admin_user = users_map.get("admin@optibuild.io")
    admin_id = admin_user.id if admin_user else None
    store_user = users_map.get("store@optibuild.io")
    store_id = store_user.id if store_user else admin_id

    # 1. Flagship Project Record
    project = db.query(Project).filter(Project.id == FLAGSHIP_PROJECT_ID).first()
    if not project:
        project = Project(
            id=FLAGSHIP_PROJECT_ID,
            organization_id=org.id if org else None,
            name="Emerald Heights Phase 2 (Tower A & B)",
            status="IN_PROGRESS",
            rera_registration_no="P52100018921",
            promoter_name="Skyline Landmark Developers LLP",
            proposed_completion_date="2026-12-31",
            plot_area_sqft=45000.0,
            built_up_area_sqft=75000.0,
            carpet_area_sqft=52500.0,
            number_of_floors=14,
            number_of_basements=2,
            base_rate_per_sqft=2400.0,
            total_project_cost=180000000.0,
            total_allottee_investment=126000000.0,
            sbi_mclr_rate=0.0885,
            rera_spread=0.0200,
            delay_days=14,
            data_sharing_consent=True,
            consent_given_at=datetime.utcnow(),
            anonymized_telemetry_opt_in=True,
            created_by_id=admin_id,
            created_at=datetime.utcnow(),
        )
        db.add(project)
        db.flush()
        print(f"[+] Created Flagship Project: {project.name} ({project.id})")
    else:
        project.organization_id = org.id if org else project.organization_id
        project.name = "Emerald Heights Phase 2 (Tower A & B)"
        project.status = "IN_PROGRESS"
        project.rera_registration_no = "P52100018921"
        project.promoter_name = "Skyline Landmark Developers LLP"
        project.proposed_completion_date = "2026-12-31"
        project.plot_area_sqft = 45000.0
        project.built_up_area_sqft = 75000.0
        project.carpet_area_sqft = 52500.0
        project.number_of_floors = 14
        project.number_of_basements = 2
        project.base_rate_per_sqft = 2400.0
        project.total_project_cost = 180000000.0
        project.total_allottee_investment = 126000000.0
        project.sbi_mclr_rate = 0.0885
        project.rera_spread = 0.0200
        project.delay_days = 14
        project.data_sharing_consent = True
        project.consent_given_at = datetime.utcnow()
        project.anonymized_telemetry_opt_in = True
        if admin_id and not project.created_by_id:
            project.created_by_id = admin_id
        print(f"[*] Updated Flagship Project: {project.name} ({project.id})")

    # 2. Confirmed MahaRERA Certificate Record
    cert = db.query(RERACertificateModel).filter(
        RERACertificateModel.project_id == FLAGSHIP_PROJECT_ID
    ).first()
    if not cert:
        cert = RERACertificateModel(
            project_id=FLAGSHIP_PROJECT_ID,
            rera_registration_no="P52100018921",
            project_name="Emerald Heights Phase 2 (Tower A & B)",
            promoter_name="Skyline Landmark Developers LLP",
            proposed_completion_date="2026-12-31",
            plot_area_sqft=45000.0,
            built_up_area_sqft=75000.0,
            carpet_area_sqft=52500.0,
            number_of_floors=14,
            number_of_basements=2,
            total_project_cost=180000000.0,
            status="CONFIRMED",
            confirmed_at=datetime.utcnow(),
        )
        db.add(cert)

    # 3. Team Assignment (All 7 Roles)
    role_assignments = [
        ("admin@optibuild.io", "admin"),
        ("pm@optibuild.io", "project_manager"),
        ("engineer@optibuild.io", "site_engineer"),
        ("site@optibuild.io", "site_engineer"),
        ("store@optibuild.io", "store_keeper"),
        ("architect@optibuild.io", "architect"),
        ("accountant@optibuild.io", "accountant"),
        ("owner@optibuild.io", "owner"),
    ]
    for email, role in role_assignments:
        u = users_map.get(email) or db.query(User).filter(User.email == email).first()
        if u:
            membership = db.query(ProjectMember).filter(
                ProjectMember.project_id == FLAGSHIP_PROJECT_ID,
                ProjectMember.user_id == u.id,
            ).first()
            if not membership:
                db.add(ProjectMember(project_id=FLAGSHIP_PROJECT_ID, user_id=u.id, role=role))
            else:
                membership.role = role

    # 4. Parametric WBS Generation (6 Packages / 12 Sub-elements)
    b_params = BuildingParametersInput(
        project_name="Emerald Heights Phase 2 (Tower A & B)",
        plot_area_sqft=45000.0,
        built_up_area_sqft=75000.0,
        carpet_area_sqft=52500.0,
        number_of_floors=14,
        number_of_basements=2,
        base_rate_per_sqft=2400.0,
        target_handover_date="2026-12-31",
    )
    wbs_res = WBSGenerator.generate(b_params)
    wbs_data = wbs_res.model_dump()
    project.wbs_data = wbs_data

    tasks_list = getattr(wbs_res, "generated_tasks", None) or getattr(wbs_res, "dag_tasks", [])
    task_input_items = [
        TaskInputItem(
            id=item.id,
            name=item.name,
            duration=item.duration,
            normal_cost=float(getattr(item, "normal_cost", None) or getattr(item, "cost_normal", None) or 0.0),
            crash_cost=float(getattr(item, "crash_cost", None) or getattr(item, "cost_crash", None) or (float(getattr(item, "normal_cost", 0.0) or 0.0) * 1.35)),
            crash_duration=getattr(item, "crash_duration", None) or max(1, int(item.duration * 0.65)),
            predecessors=item.predecessors or [],
            resource_demands=item.resource_demands or {},
        )
        for item in tasks_list
    ]

    # 5. CPM & RCPSP Genetic Algorithm Schedule Computation
    resource_limits = {"labor": 32, "crane": 1}
    cpm_res = CPMEngine(task_input_items).compute()
    ga_res = RCPSPGeneticAlgorithm(
        tasks=task_input_items,
        resource_limits=resource_limits,
        population_size=30,
        generations=40,
        seed=42,
    ).solve()

    schedule_data = {
        "project_id": FLAGSHIP_PROJECT_ID,
        "project_name": "Emerald Heights Phase 2 (Tower A & B)",
        "cpm": cpm_res.model_dump(),
        "ga": ga_res.model_dump(),
        "resource_limits": resource_limits,
    }
    project.schedule_data = schedule_data

    # 6. TaskModel Rows (Live Site Status for IN_PROGRESS Flagship)
    progress_map = {
        "WBS-1.1": {"progress": 100.0, "status": "COMPLETED", "start": "2026-01-15", "finish": "2026-02-08"},
        "WBS-1.2": {"progress": 100.0, "status": "COMPLETED", "start": "2026-02-10", "finish": "2026-03-30"},
        "WBS-2.1": {"progress": 100.0, "status": "COMPLETED", "start": "2026-04-01", "finish": "2026-05-15"},
        "WBS-2.2": {"progress": 65.0, "status": "IN_PROGRESS", "start": "2026-05-18", "finish": None},
    }
    cpm_map = {t.id: t for t in cpm_res.tasks}

    for item in task_input_items:
        cpm_item = cpm_map.get(item.id)
        is_crit = getattr(cpm_item, "is_critical", False) if cpm_item else False
        if item.id in ("WBS-1.1", "WBS-1.2", "WBS-2.1", "WBS-2.2", "WBS-2.3"):
            is_crit = True

        tot_float = 0 if is_crit else (getattr(cpm_item, "total_float", 0) if cpm_item else 0)
        fr_float = 0 if is_crit else (getattr(cpm_item, "free_float", 0) if cpm_item else 0)
        p_info = progress_map.get(item.id, {"progress": 0.0, "status": "NOT_STARTED", "start": None, "finish": None})

        t_db = db.query(TaskModel).filter(
            TaskModel.project_id == FLAGSHIP_PROJECT_ID,
            TaskModel.id == item.id,
        ).first()
        if not t_db:
            t_db = TaskModel(
                id=item.id,
                project_id=FLAGSHIP_PROJECT_ID,
                name=item.name,
                duration=item.duration,
                normal_cost=item.normal_cost,
                crash_cost=item.crash_cost,
                crash_duration=item.crash_duration,
                predecessors=item.predecessors,
                resource_demands=item.resource_demands,
                is_critical=is_crit,
                total_float=tot_float,
                free_float=fr_float,
                progress_percent=p_info["progress"],
                status=p_info["status"],
                actual_start=p_info["start"],
                actual_finish=p_info["finish"],
            )
            db.add(t_db)
        else:
            t_db.name = item.name
            t_db.duration = item.duration
            t_db.normal_cost = item.normal_cost
            t_db.crash_cost = item.crash_cost
            t_db.crash_duration = item.crash_duration
            t_db.predecessors = item.predecessors
            t_db.resource_demands = item.resource_demands
            t_db.is_critical = is_crit
            t_db.total_float = tot_float
            t_db.free_float = fr_float
            t_db.progress_percent = p_info["progress"]
            t_db.status = p_info["status"]
            t_db.actual_start = p_info["start"]
            t_db.actual_finish = p_info["finish"]

    # 7. MahaRERA Section 18 Delay Penalty vs Crashing Optimizer
    rera_params = RERAPenaltyParams(
        total_allottee_investment=126000000.0,
        sbi_mclr_rate=8.85,
        rera_spread=2.00,
        delay_days=14,
    )
    crashable_tasks = [
        CrashableTaskItem(
            id=t.id,
            name=t.name,
            normal_duration=t.duration,
            crash_duration=t.crash_duration or max(1, int(t.duration * 0.65)),
            normal_cost=t.normal_cost or 0.0,
            crash_cost=t.crash_cost or ((t.normal_cost or 0.0) * 1.35),
            predecessors=t.predecessors or [],
        )
        for t in task_input_items
    ]
    opt_res = DelayRecoveryOptimizer.evaluate(
        rera_params=rera_params,
        tasks=crashable_tasks,
        target_recovery_days=14,
    )
    optimizer_data = opt_res.model_dump()
    project.optimizer_data = optimizer_data

    eval_model = db.query(DelayRecoveryEvaluationModel).filter(
        DelayRecoveryEvaluationModel.project_id == FLAGSHIP_PROJECT_ID
    ).first()
    if not eval_model:
        eval_model = DelayRecoveryEvaluationModel(
            project_id=FLAGSHIP_PROJECT_ID,
            delay_days=opt_res.delay_days,
            rera_daily_penalty=opt_res.rera_daily_penalty,
            rera_total_penalty=opt_res.total_rera_penalty,
            total_crash_cost=opt_res.total_crash_cost,
            days_recovered=opt_res.days_recovered,
            net_savings=opt_res.net_savings,
            recommendation=opt_res.recommendation,
            crashing_actions=optimizer_data.get("crashing_actions"),
            evaluated_at=datetime.utcnow(),
        )
        db.add(eval_model)
    else:
        eval_model.delay_days = opt_res.delay_days
        eval_model.rera_daily_penalty = opt_res.rera_daily_penalty
        eval_model.rera_total_penalty = opt_res.total_rera_penalty
        eval_model.total_crash_cost = opt_res.total_crash_cost
        eval_model.days_recovered = opt_res.days_recovered
        eval_model.net_savings = opt_res.net_savings
        eval_model.recommendation = opt_res.recommendation
        eval_model.crashing_actions = optimizer_data.get("crashing_actions")

    # 8. Material Procurement Receipts (Actual Expenditure for S-Curve)
    flagship_materials = [
        {
            "entry_id": "MAT-EMR-001",
            "date": "2026-09-15",
            "material_category": "Steel / Rebar",
            "item_description": "TMT Steel Fe550D (16mm & 20mm High Yield Primary)",
            "wbs_code": "WBS-2.1",
            "quantity": 25.0,
            "unit": "MT",
            "unit_rate": 58500.0,
            "total_amount": 1462500.0,
            "supplier_name": "Tata Tiscon / B.K. Steels Pune",
            "invoice_no": "INV-2026-TMT-0881",
            "bill_attachment_url": "evidence/bills/emerald_ph2_steel_inv0881.pdf",
        },
        {
            "entry_id": "MAT-EMR-002",
            "date": "2026-09-28",
            "material_category": "RMC Concrete",
            "item_description": "Ready Mix Concrete M30 Grade (Pumpable Mix)",
            "wbs_code": "WBS-1.2",
            "quantity": 160.0,
            "unit": "Cu.m",
            "unit_rate": 4450.0,
            "total_amount": 712000.0,
            "supplier_name": "Godrej Construction RMC Pune",
            "invoice_no": "INV-2026-RMC-4412",
            "bill_attachment_url": "evidence/bills/emerald_ph2_rmc_inv4412.pdf",
        },
        {
            "entry_id": "MAT-EMR-003",
            "date": "2026-10-08",
            "material_category": "Cement",
            "item_description": "Ultratech OPC 53 Grade Cement (50kg Bags)",
            "wbs_code": "WBS-1.2",
            "quantity": 800.0,
            "unit": "Bags",
            "unit_rate": 390.0,
            "total_amount": 312000.0,
            "supplier_name": "Ultratech Building Solutions",
            "invoice_no": "INV-2026-CEM-1904",
            "bill_attachment_url": "evidence/bills/emerald_ph2_cement_inv1904.pdf",
        },
        {
            "entry_id": "MAT-EMR-004",
            "date": "2026-10-18",
            "material_category": "Sand & Aggregates",
            "item_description": "Crushed River Sand & 20mm Blue Metal Aggregates",
            "wbs_code": "WBS-1.1",
            "quantity": 45.0,
            "unit": "Brass",
            "unit_rate": 7100.0,
            "total_amount": 319500.0,
            "supplier_name": "Sahyadri Quarry & Minerals",
            "invoice_no": "INV-2026-AGG-0731",
            "bill_attachment_url": "evidence/bills/emerald_ph2_agg_inv0731.pdf",
        },
    ]

    for mat in flagship_materials:
        existing_mat = db.query(MaterialLogModel).filter(
            MaterialLogModel.project_id == FLAGSHIP_PROJECT_ID,
            MaterialLogModel.entry_id == mat["entry_id"],
        ).first()
        if not existing_mat:
            db.add(MaterialLogModel(
                entry_id=mat["entry_id"],
                project_id=FLAGSHIP_PROJECT_ID,
                date=mat["date"],
                material_category=mat["material_category"],
                item_description=mat["item_description"],
                wbs_code=mat["wbs_code"],
                quantity=mat["quantity"],
                unit=mat["unit"],
                unit_rate=mat["unit_rate"],
                total_amount=mat["total_amount"],
                supplier_name=mat["supplier_name"],
                invoice_no=mat["invoice_no"],
                bill_attachment_url=mat["bill_attachment_url"],
                logged_by_id=store_id,
                created_at=datetime.utcnow(),
            ))
        else:
            existing_mat.date = mat["date"]
            existing_mat.material_category = mat["material_category"]
            existing_mat.item_description = mat["item_description"]
            existing_mat.wbs_code = mat["wbs_code"]
            existing_mat.quantity = mat["quantity"]
            existing_mat.unit = mat["unit"]
            existing_mat.unit_rate = mat["unit_rate"]
            existing_mat.total_amount = mat["total_amount"]
            existing_mat.supplier_name = mat["supplier_name"]
            existing_mat.invoice_no = mat["invoice_no"]
            existing_mat.bill_attachment_url = mat["bill_attachment_url"]
            existing_mat.logged_by_id = store_id

    db.commit()

    # 9. Harvest Anonymized Training Dataset Sample
    try:
        from backend.app.engine.data_pipeline import harvest_consented_project
        harvest_res = harvest_consented_project(FLAGSHIP_PROJECT_ID, db)
        print(f"[+] Harvested flagship project into anonymized training dataset: {harvest_res}")
    except Exception as _ex:
        print(f"[*] Training dataset notice: {_ex}")

    print(f"[SUCCESS] Flagship project seeded: {FLAGSHIP_PROJECT_ID} with 8 members, tasks, schedule, optimizer & material logs.")


def seed_database():
    """
    Seeds the 7 demo role users, organization, and the flagship showcase project.
    """
    print("[*] Running OptiBuild seed script...")
    from backend.app.db.session import engine, Base
    import backend.app.db.models
    if engine:
        Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Seed or find organization
        org = db.query(Organization).filter(Organization.name == DEMO_ORGANIZATION_NAME).first()
        if not org:
            org = Organization(name=DEMO_ORGANIZATION_NAME)
            db.add(org)
            db.commit()
            db.refresh(org)
            print(f"[+] Created organization: {org.name} ({org.id})")
        else:
            print(f"[*] Organization exists: {org.name} ({org.id})")

        # 2. Seed 7 demo role users
        created_count = 0
        updated_count = 0
        users_map = {}
        for user_data in DEMO_USERS:
            existing = db.query(User).filter(User.email == user_data["email"]).first()
            if not existing:
                user = User(
                    email=user_data["email"],
                    hashed_password=hash_password(user_data["password"]),
                    full_name=user_data["full_name"],
                    role=user_data["role"],
                    is_active=True,
                )
                db.add(user)
                created_count += 1
                users_map[user_data["email"]] = user
                print(f"[+] Created user: {user_data['email']} [role: {user_data['role']}]")
            else:
                existing.hashed_password = hash_password(user_data["password"])
                existing.full_name = user_data["full_name"]
                existing.role = user_data["role"]
                existing.is_active = True
                updated_count += 1
                users_map[user_data["email"]] = existing
                print(f"[*] Updated password & role for user: {user_data['email']} [role: {user_data['role']}]")

        db.commit()
        for email, u in users_map.items():
            db.refresh(u)

        # 3. Seed Flagship Showcase Project
        seed_flagship_project(db, org, users_map)

        print(f"\n[SUCCESS] Seed complete. {created_count} users created, {updated_count} users refreshed.")
        print("[*] Demo users and flagship showcase project 'Emerald Heights Phase 2' are ready.")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {e}")
        raise
    finally:
        db.close()


def auto_seed_if_empty():
    """
    Called on FastAPI startup. If users or projects table is empty,
    seeds the 7 demo accounts and the flagship project automatically.
    """
    from backend.app.db.session import SessionLocal
    if not SessionLocal:
        return
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        project_count = db.query(Project).count()
        if user_count == 0 or project_count == 0:
            print("[*] Incomplete database detected on startup (users: %d, projects: %d). Auto-seeding..." % (user_count, project_count))
            seed_database()
    except Exception as e:
        print(f"[Warning] Auto-seed check failed: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
