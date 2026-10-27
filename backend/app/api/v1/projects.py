import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.auth import (
    get_current_user,
    require_roles,
    check_project_membership,
    verify_project_membership,
)
from backend.app.db.session import get_db
from backend.app.db.models import (
    User,
    Project,
    ProjectMember,
    TaskModel,
    ProjectDrawing,
    SitePhotoModel,
    DelayRecoveryEvaluationModel,
)
from backend.app.storage.s3 import storage
from backend.app.schemas.wbs import BuildingParametersInput
from backend.app.engine.wbs_generator import WBSGenerator
from backend.app.schemas.schedule import TaskInputItem, ScheduleRequest
from backend.app.engine.cpm import CPMEngine
from backend.app.engine.ga import RCPSPGeneticAlgorithm
from backend.app.schemas.optimizer import RERAPenaltyParams, CrashableTaskItem
from backend.app.engine.optimizer import DelayRecoveryOptimizer
from backend.app.engine.benchmark import BenchmarkEngine
from backend.app.engine.classifier import SitePhotoClassifier

router = APIRouter(prefix="/projects", tags=["Project Lifecycle & Role Workflow"])


class UpdateTaskProgressRequest(BaseModel):
    progress_percent: float
    status: Optional[str] = None  # NOT_STARTED, IN_PROGRESS, COMPLETED
    actual_start: Optional[str] = None
    actual_finish: Optional[str] = None


class AssignMemberRequest(BaseModel):
    user_id: str
    role: str  # project_manager, site_engineer, store_keeper, architect, accountant, owner


class RunSchedulePayload(BaseModel):
    resource_limits: Optional[Dict[str, int]] = None
    ga_population_size: Optional[int] = 40
    ga_generations: Optional[int] = 80


@router.get("")
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all projects the user is authorized to see.
    - Admin: all projects
    - Others: assigned projects or all org projects
    """
    if current_user.role == "admin":
        projects = db.query(Project).order_by(Project.created_at.desc()).all()
    else:
        assigned_ids = [
            m.project_id
            for m in db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).all()
        ]
        projects = (
            db.query(Project)
            .filter((Project.created_by_id == current_user.id) | (Project.id.in_(assigned_ids)))
            .order_by(Project.created_at.desc())
            .all()
        )

    return [
        {
            "id": p.id,
            "name": p.name,
            "status": p.status,
            "rera_registration_no": p.rera_registration_no,
            "promoter_name": p.promoter_name,
            "proposed_completion_date": p.proposed_completion_date,
            "built_up_area_sqft": p.built_up_area_sqft,
            "number_of_floors": p.number_of_floors,
            "total_project_cost": p.total_project_cost,
            "delay_days": p.delay_days,
            "has_wbs": p.wbs_data is not None,
            "has_schedule": p.schedule_data is not None,
            "has_optimizer": p.optimizer_data is not None,
            "members_count": len(p.members) if p.members else 0,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in projects
    ]


@router.get("/{project_id}")
def get_project_detail(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns complete project details, including WBS, Schedule, Optimizer results,
    tasks, drawings, and team members.
    """
    project = verify_project_membership(project_id, current_user, db)

    tasks = db.query(TaskModel).filter(TaskModel.project_id == project_id).all()
    drawings = db.query(ProjectDrawing).filter(ProjectDrawing.project_id == project_id).all()
    photos = db.query(SitePhotoModel).filter(SitePhotoModel.project_id == project_id).all()
    members = db.query(ProjectMember).filter(ProjectMember.project_id == project_id).all()

    return {
        "id": project.id,
        "name": project.name,
        "status": project.status,
        "rera_registration_no": project.rera_registration_no,
        "promoter_name": project.promoter_name,
        "proposed_completion_date": project.proposed_completion_date,
        "plot_area_sqft": project.plot_area_sqft,
        "built_up_area_sqft": project.built_up_area_sqft,
        "carpet_area_sqft": project.carpet_area_sqft,
        "number_of_floors": project.number_of_floors,
        "number_of_basements": project.number_of_basements,
        "base_rate_per_sqft": project.base_rate_per_sqft,
        "total_project_cost": project.total_project_cost,
        "total_allottee_investment": project.total_allottee_investment,
        "delay_days": project.delay_days,
        "has_wbs": project.wbs_data is not None,
        "has_schedule": project.schedule_data is not None,
        "has_optimizer": project.optimizer_data is not None,
        "members_count": len(members),
        "wbs_data": project.wbs_data,
        "schedule_data": project.schedule_data,
        "optimizer_data": project.optimizer_data,
        "benchmark_data": project.benchmark_data,
        "tasks": [
            {
                "id": t.id,
                "name": t.name,
                "duration": t.duration,
                "normal_cost": t.normal_cost,
                "crash_cost": t.crash_cost,
                "crash_duration": t.crash_duration,
                "predecessors": t.predecessors or [],
                "resource_demands": t.resource_demands or {},
                "is_critical": t.is_critical,
                "total_float": t.total_float,
                "free_float": t.free_float,
                "progress_percent": t.progress_percent,
                "status": t.status,
                "actual_start": t.actual_start,
                "actual_finish": t.actual_finish,
            }
            for t in tasks
        ],
        "drawings": [
            {
                "id": d.id,
                "title": d.title,
                "drawing_type": d.drawing_type,
                "file_name": d.file_name,
                "file_url": storage.get_download_url(d.file_url),
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            }
            for d in drawings
        ],
        "photos": [
            {
                "id": ph.id,
                "photo_url": storage.get_download_url(ph.photo_url),
                "predicted_stage": ph.predicted_stage,
                "stage_label": ph.stage_label,
                "confidence_score": ph.confidence_score,
                "engineer_confirmed_stage": ph.engineer_confirmed_stage,
                "uploaded_at": ph.uploaded_at.isoformat() if ph.uploaded_at else None,
            }
            for ph in photos
        ],
        "members": [
            {
                "id": m.id,
                "user_id": m.user_id,
                "user_email": m.user.email if m.user else None,
                "user_name": m.user.full_name if m.user else None,
                "role": m.role,
            }
            for m in members
        ],
    }


@router.post("/{project_id}/members")
def assign_project_member(
    project_id: str,
    payload: AssignMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Assigns a user to a project with a specific project role.
    """
    project = verify_project_membership(
        project_id, current_user, db, allowed_roles=["admin", "project_manager"]
    )

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    existing = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == payload.user_id)
        .first()
    )
    if existing:
        existing.role = payload.role
        db.commit()
        return {"message": f"Updated role of {user.full_name} to {payload.role}."}

    membership = ProjectMember(
        project_id=project_id,
        user_id=payload.user_id,
        role=payload.role,
    )
    db.add(membership)
    db.commit()
    return {"message": f"Assigned {user.full_name} to project as {payload.role}."}


@router.post("/{project_id}/wbs")
def generate_and_save_wbs(
    project_id: str,
    payload: BuildingParametersInput,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates a parametric WBS from building parameters and saves it to the project.
    Creates or updates the tasks in the database.
    """
    project = verify_project_membership(
        project_id, current_user, db, allowed_roles=["project_manager", "admin"]
    )

    # Generate WBS
    if not payload.project_name or not payload.project_name.strip():
        payload.project_name = project.name
    wbs_result = WBSGenerator.generate(payload)
    wbs_data = wbs_result.model_dump()

    # Update project parameters
    project.built_up_area_sqft = payload.built_up_area_sqft
    project.number_of_floors = payload.number_of_floors
    project.number_of_basements = payload.number_of_basements
    project.base_rate_per_sqft = payload.base_rate_per_sqft
    project.total_project_cost = wbs_result.total_estimated_cost
    project.wbs_data = wbs_data

    # Clear old tasks and populate new tasks from WBS
    db.query(TaskModel).filter(TaskModel.project_id == project_id).delete()

    for item in wbs_result.dag_tasks:
        task_model = TaskModel(
            id=item.id,
            project_id=project_id,
            name=item.name,
            duration=item.duration,
            normal_cost=item.normal_cost,
            crash_cost=item.crash_cost,
            crash_duration=item.crash_duration,
            predecessors=item.predecessors or [],
            resource_demands=item.resource_demands or {},
            is_critical=item.is_critical,
            total_float=item.total_float,
            free_float=item.free_float,
            progress_percent=0.0,
            status="NOT_STARTED",
        )
        db.add(task_model)

    db.commit()
    db.refresh(project)

    return {
        "status": "WBS_GENERATED",
        "project_id": project.id,
        "total_estimated_cost": project.total_project_cost,
        "task_count": len(wbs_result.dag_tasks),
        "wbs_data": wbs_data,
    }


@router.post("/{project_id}/schedule")
def run_and_save_schedule(
    project_id: str,
    payload: RunSchedulePayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Runs CPM and Genetic Algorithm RCPSP for the project tasks and saves results.
    """
    project = verify_project_membership(
        project_id, current_user, db, allowed_roles=["project_manager", "admin"]
    )

    db_tasks = db.query(TaskModel).filter(TaskModel.project_id == project_id).all()
    if not db_tasks:
        raise HTTPException(status_code=400, detail="Project has no tasks. Generate WBS first.")

    task_items = [
        TaskInputItem(
            id=t.id,
            name=t.name,
            duration=t.duration,
            normal_cost=t.normal_cost,
            crash_cost=t.crash_cost,
            crash_duration=t.crash_duration,
            predecessors=t.predecessors or [],
            resource_demands=t.resource_demands or {},
        )
        for t in db_tasks
    ]

    resource_limits = payload.resource_limits or {"labor": 32, "crane": 1}

    # 1. Unconstrained CPM baseline
    cpm_engine = CPMEngine(task_items)
    cpm_result = cpm_engine.compute()

    # 2. Resource-Constrained Project Scheduling via Genetic Algorithm
    ga_engine = RCPSPGeneticAlgorithm(
        tasks=task_items,
        resource_limits=resource_limits,
        population_size=payload.ga_population_size or 40,
        generations=payload.ga_generations or 80,
    )
    ga_result = ga_engine.solve()

    schedule_data = {
        "project_id": project.id,
        "project_name": project.name,
        "cpm": cpm_result.model_dump(),
        "ga": ga_result.model_dump(),
        "resource_limits": resource_limits,
    }

    # Update tasks in database with CPM results
    cpm_task_map = {t.id: t for t in cpm_result.tasks}
    for t in db_tasks:
        if t.id in cpm_task_map:
            ct = cpm_task_map[t.id]
            t.is_critical = ct.is_critical
            t.total_float = ct.total_float
            t.free_float = ct.free_float

    project.schedule_data = schedule_data
    db.commit()

    return schedule_data


@router.post("/{project_id}/optimizer")
def run_and_save_optimizer(
    project_id: str,
    target_recovery_days: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Evaluates statutory MahaRERA delay penalties against schedule crashing costs.
    Stores the evaluation record into the database.
    """
    project = verify_project_membership(
        project_id, current_user, db, allowed_roles=["project_manager", "admin"]
    )

    db_tasks = db.query(TaskModel).filter(TaskModel.project_id == project_id).all()
    if not db_tasks:
        raise HTTPException(status_code=400, detail="Project has no tasks. Generate WBS first.")

    recovery_days = target_recovery_days if target_recovery_days is not None else (project.delay_days or 14)

    raw_mclr = project.sbi_mclr_rate if project.sbi_mclr_rate is not None else 8.85
    sbi_mclr = raw_mclr * 100.0 if raw_mclr < 1.0 else raw_mclr

    raw_spread = project.rera_spread if project.rera_spread is not None else 2.0
    rera_spread = raw_spread * 100.0 if raw_spread < 1.0 else raw_spread

    allottee_inv = project.total_allottee_investment
    if not allottee_inv:
        if project.total_project_cost:
            allottee_inv = project.total_project_cost * 0.70
        else:
            allottee_inv = 10000000.0

    rera_params = RERAPenaltyParams(
        total_allottee_investment=allottee_inv,
        sbi_mclr_rate=sbi_mclr,
        rera_spread=rera_spread,
        delay_days=recovery_days,
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
        for t in db_tasks
    ]

    result = DelayRecoveryOptimizer.evaluate(
        rera_params=rera_params,
        tasks=crashable_tasks,
        target_recovery_days=recovery_days,
    )

    optimizer_data = result.model_dump()
    project.optimizer_data = optimizer_data

    eval_model = DelayRecoveryEvaluationModel(
        project_id=project.id,
        delay_days=result.delay_days,
        rera_daily_penalty=result.rera_daily_penalty,
        rera_total_penalty=result.total_rera_penalty,
        total_crash_cost=result.total_crash_cost,
        days_recovered=result.days_recovered,
        net_savings=result.net_savings,
        recommendation=result.recommendation,
        crashing_actions=optimizer_data.get("crashing_actions"),
    )
    db.add(eval_model)
    db.commit()

    return optimizer_data


@router.post("/{project_id}/benchmark")
def run_and_save_benchmark(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Runs OR-Tools CP-SAT and GA benchmark on the project's real network.
    """
    project = verify_project_membership(
        project_id, current_user, db, allowed_roles=["project_manager", "admin"]
    )

    db_tasks = db.query(TaskModel).filter(TaskModel.project_id == project_id).all()
    if not db_tasks:
        raise HTTPException(status_code=400, detail="Project has no tasks. Generate WBS first.")

    task_items = [
        TaskInputItem(
            id=t.id,
            name=t.name,
            duration=t.duration,
            normal_cost=t.normal_cost,
            crash_cost=t.crash_cost,
            crash_duration=t.crash_duration,
            predecessors=t.predecessors or [],
            resource_demands=t.resource_demands or {},
        )
        for t in db_tasks
    ]

    limits = {"labor": 32, "crane": 1}
    result = BenchmarkEngine.run_benchmark(
        benchmark_name=f"{project.name} Benchmark",
        tasks=task_items,
        resource_limits=limits,
    )
    benchmark_data = result.model_dump()
    project.benchmark_data = benchmark_data
    db.commit()

    return benchmark_data


@router.patch("/{project_id}/tasks/{task_id}/progress")
def update_task_progress(
    project_id: str,
    task_id: str,
    payload: UpdateTaskProgressRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates progress percentage and completion status for a site activity.
    Permitted for Site Engineers, PMs, and Admins.
    """
    verify_project_membership(
        project_id, current_user, db, allowed_roles=["site_engineer", "project_manager", "admin"]
    )
    task = (
        db.query(TaskModel)
        .filter(TaskModel.project_id == project_id, TaskModel.id == task_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found in project.")

    task.progress_percent = max(0.0, min(100.0, payload.progress_percent))
    if payload.status:
        task.status = payload.status
    elif task.progress_percent == 100.0:
        task.status = "COMPLETED"
    elif task.progress_percent > 0.0:
        task.status = "IN_PROGRESS"

    if payload.actual_start:
        task.actual_start = payload.actual_start
    if payload.actual_finish:
        task.actual_finish = payload.actual_finish

    db.commit()
    db.refresh(task)

    return {
        "status": "UPDATED",
        "task_id": task.id,
        "progress_percent": task.progress_percent,
        "task_status": task.status,
    }


@router.get("/{project_id}/drawings")
def list_project_drawings(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists all architectural and engineering drawings attached to this project.
    """
    verify_project_membership(project_id, current_user, db)
    drawings = db.query(ProjectDrawing).filter(ProjectDrawing.project_id == project_id).all()
    return [
        {
            "id": d.id,
            "title": d.title,
            "drawing_type": d.drawing_type,
            "file_name": d.file_name,
            "file_url": storage.get_download_url(d.file_url),
            "uploaded_by_id": d.uploaded_by_id,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
        }
        for d in drawings
    ]


@router.post("/{project_id}/drawings")
async def upload_architect_drawing(
    project_id: str,
    title: str = Form(...),
    drawing_type: str = Form("ARCHITECTURAL"),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Attaches an architectural drawing to the project.
    LOCKED RULE: Architect drawing files are stored for human viewing ONLY and are NEVER parsed.
    """
    project = verify_project_membership(
        project_id, current_user, db, allowed_roles=["architect", "admin"]
    )

    content = await file.read()
    file_url = storage.upload_architect_drawing(content, file.filename, project_id=project_id)

    drawing = ProjectDrawing(
        project_id=project_id,
        title=title.strip(),
        drawing_type=drawing_type,
        file_name=file.filename,
        file_url=file_url,
        uploaded_by_id=current_user.id,
    )
    db.add(drawing)
    db.commit()
    db.refresh(drawing)

    return {
        "status": "ATTACHED",
        "id": drawing.id,
        "title": drawing.title,
        "file_name": drawing.file_name,
        "file_url": drawing.file_url,
        "message": "Architectural drawing stored for human viewing. Never parsed.",
    }


@router.get("/{project_id}/photos")
def list_site_photos(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists all site photos uploaded and classified for this project.
    """
    verify_project_membership(project_id, current_user, db)
    photos = db.query(SitePhotoModel).filter(SitePhotoModel.project_id == project_id).all()
    return [
        {
            "id": p.id,
            "photo_url": storage.get_download_url(p.photo_url),
            "predicted_stage": p.predicted_stage,
            "stage_label": p.stage_label,
            "confidence_score": p.confidence_score,
            "detected_features": p.detected_features,
            "notes": p.notes,
            "engineer_confirmed_stage": p.engineer_confirmed_stage,
            "uploaded_at": p.uploaded_at.isoformat() if p.uploaded_at else None,
        }
        for p in photos
    ]


@router.post("/{project_id}/photos")
async def upload_site_photo(
    project_id: str,
    notes: Optional[str] = Form(None),
    engineer_confirmed_stage: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Uploads a site photo, runs classifier heuristics, and stores record in database.
    """
    project = verify_project_membership(
        project_id, current_user, db, allowed_roles=["site_engineer", "project_manager", "admin"]
    )

    content = await file.read()
    photo_url = storage.upload_site_photo(content, file.filename, project_id=project_id)

    classification = SitePhotoClassifier.classify_image_bytes(content, file.filename)

    photo_record = SitePhotoModel(
        project_id=project_id,
        photo_url=photo_url,
        predicted_stage=classification.predicted_stage,
        stage_label=classification.stage_label,
        confidence_score=classification.confidence_score,
        detected_features=classification.detected_features,
        notes=notes,
        engineer_confirmed_stage=engineer_confirmed_stage or classification.predicted_stage,
        uploaded_by_id=current_user.id,
    )
    db.add(photo_record)
    db.commit()
    db.refresh(photo_record)

    return {
        "id": photo_record.id,
        "photo_url": photo_record.photo_url,
        "predicted_stage": photo_record.predicted_stage,
        "stage_label": photo_record.stage_label,
        "confidence_score": photo_record.confidence_score,
        "detected_features": photo_record.detected_features,
        "message": "Site photo classified and recorded.",
    }
