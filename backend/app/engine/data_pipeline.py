import hmac
import hashlib
import json
import math
from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from backend.app.db.models import (
    Project,
    TaskModel,
    MaterialLogModel,
    SitePhotoModel,
    DelayRecoveryEvaluationModel,
    TrainingDataSample,
)

SALT = "optibuild_training_pipeline_salt_v1"


def generate_anonymized_project_hash(project_id: str) -> str:
    """
    Computes a one-way HMAC-SHA256 hash of the project_id.
    Irreversible de-identification ensuring compliance with DPDP Act 2023.
    """
    return hmac.new(SALT.encode("utf-8"), project_id.encode("utf-8"), hashlib.sha256).hexdigest()[:32]


def sanitize_project_metadata(project: Project) -> Dict[str, Any]:
    """
    Strips all developer legal names, promoter identities, exact plot IDs,
    RERA certificate numbers, and addresses.
    Retains only physical and dimensional ratios.
    """
    carpet_to_built_up = 0.70
    if project.built_up_area_sqft and project.built_up_area_sqft > 0:
        carpet_to_built_up = (project.carpet_area_sqft or 0.0) / project.built_up_area_sqft

    return {
        "built_up_area_sqft": project.built_up_area_sqft or 0.0,
        "carpet_to_built_up_ratio": round(carpet_to_built_up, 4),
        "number_of_floors": project.number_of_floors or 0,
        "number_of_basements": project.number_of_basements or 0,
        "base_rate_per_sqft": project.base_rate_per_sqft or 2400.0,
    }


def extract_rcpsp_training_sample(project: Project, db: Session) -> Optional[Dict[str, Any]]:
    """
    Extracts topological graph parameters and GA scheduling performance.
    Used for calibrating GA population, generations, and priority-rule selection.
    """
    tasks = db.query(TaskModel).filter(TaskModel.project_id == project.id).all()
    if not tasks:
        return None

    num_tasks = len(tasks)
    edge_count = 0
    durations = []
    has_critical_count = 0

    for t in tasks:
        preds = t.predecessors or []
        edge_count += len(preds)
        durations.append(t.duration or 1)
        if t.is_critical:
            has_critical_count += 1

    max_possible_edges = max(1, (num_tasks * (num_tasks - 1)) // 2)
    density = edge_count / max_possible_edges
    mean_duration = sum(durations) / max(1, len(durations))

    # Pull schedule target metrics if available
    cpm_makespan = None
    ga_makespan = None
    makespan_dilation = None

    if project.schedule_data and isinstance(project.schedule_data, dict):
        cpm_info = project.schedule_data.get("cpm", {})
        ga_info = project.schedule_data.get("ga", {})
        cpm_makespan = cpm_info.get("project_makespan")
        ga_makespan = ga_info.get("project_makespan")
        if cpm_makespan and ga_makespan and cpm_makespan > 0:
            makespan_dilation = round(ga_makespan / cpm_makespan, 4)

    features = {
        "num_tasks": num_tasks,
        "edge_count": edge_count,
        "graph_density": round(density, 4),
        "mean_duration": round(mean_duration, 2),
        "max_duration": max(durations) if durations else 0,
        "min_duration": min(durations) if durations else 0,
        "critical_task_ratio": round(has_critical_count / max(1, num_tasks), 4),
        **sanitize_project_metadata(project),
    }

    target = {
        "cpm_makespan": cpm_makespan,
        "ga_makespan": ga_makespan,
        "makespan_dilation": makespan_dilation,
    }

    return {"features": features, "target": target}


def extract_cost_slope_training_sample(project: Project, db: Session) -> Optional[Dict[str, Any]]:
    """
    Extracts empirical material rate variances and realized crash cost slopes.
    Used for training the dynamic cost slope recalibration engine.
    """
    materials = db.query(MaterialLogModel).filter(MaterialLogModel.project_id == project.id).all()
    if not materials:
        return None

    category_rates: Dict[str, List[float]] = {}
    for m in materials:
        cat = m.material_category or "General"
        category_rates.setdefault(cat, []).append(m.unit_rate)

    avg_category_rates = {
        cat: round(sum(rates) / len(rates), 2)
        for cat, rates in category_rates.items()
    }

    features = {
        "material_entry_count": len(materials),
        "categories_logged": list(category_rates.keys()),
        **sanitize_project_metadata(project),
    }

    target = {
        "empirical_unit_rates": avg_category_rates,
    }

    return {"features": features, "target": target}


def extract_delay_recovery_sample(project: Project, db: Session) -> Optional[Dict[str, Any]]:
    """
    Extracts statutory delay liabilities and crashing recommendations.
    Used for calibrating delay risk assessment and crashing cost estimation.
    """
    evaluation = (
        db.query(DelayRecoveryEvaluationModel)
        .filter(DelayRecoveryEvaluationModel.project_id == project.id)
        .order_by(DelayRecoveryEvaluationModel.evaluated_at.desc())
        .first()
    )
    if not evaluation:
        return None

    features = {
        "delay_days": evaluation.delay_days,
        "total_project_cost": project.total_project_cost,
        "total_allottee_investment": project.total_allottee_investment,
        **sanitize_project_metadata(project),
    }

    target = {
        "rera_daily_penalty": evaluation.rera_daily_penalty,
        "rera_total_penalty": evaluation.rera_total_penalty,
        "total_crash_cost": evaluation.total_crash_cost,
        "days_recovered": evaluation.days_recovered,
        "net_savings": evaluation.net_savings,
        "recommendation": evaluation.recommendation,
    }

    return {"features": features, "target": target}


def extract_cv_vision_samples(project: Project, db: Session) -> List[Dict[str, Any]]:
    """
    Extracts visual features mapped to engineer-confirmed ground truth stages.
    Used for retraining the site stage classification model.
    """
    photos = (
        db.query(SitePhotoModel)
        .filter(
            SitePhotoModel.project_id == project.id,
            SitePhotoModel.engineer_confirmed_stage.isnot(None),
        )
        .all()
    )

    samples = []
    for p in photos:
        features = {
            "predicted_stage": p.predicted_stage,
            "confidence_score": p.confidence_score,
            "detected_features": p.detected_features or {},
        }
        target = {
            "engineer_confirmed_stage": p.engineer_confirmed_stage,
            "is_prediction_concordant": (p.predicted_stage == p.engineer_confirmed_stage),
        }
        samples.append({"features": features, "target": target})

    return samples


def harvest_consented_project(project_id: str, db: Session) -> Dict[str, int]:
    """
    Core Ingestion Gate:
    Strictly enforces that project.data_sharing_consent is True.
    Sanitizes and extracts training samples into training_data_samples.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return {"created": 0}

    # Strict Consent Enforcement Gate
    if not project.data_sharing_consent:
        raise PermissionError(
            f"Cannot harvest data from project '{project_id}': User data_sharing_consent is False."
        )

    project_hash = generate_anonymized_project_hash(project.id)
    created_counts = {"RCPSP_SCHEDULING": 0, "COST_SLOPES": 0, "DELAY_RECOVERY": 0, "CV_CLASSIFIER": 0}

    # 1. Clear existing samples for this project before re-harvesting
    db.query(TrainingDataSample).filter(TrainingDataSample.project_id == project.id).delete()

    # 2. Extract RCPSP Scheduling
    rcpsp = extract_rcpsp_training_sample(project, db)
    if rcpsp:
        sample = TrainingDataSample(
            project_id=project.id,
            domain="RCPSP_SCHEDULING",
            anonymized_project_hash=project_hash,
            features=rcpsp["features"],
            target_metrics=rcpsp["target"],
            source_version="1.0.0",
        )
        db.add(sample)
        created_counts["RCPSP_SCHEDULING"] += 1

    # 3. Extract Cost Slopes
    costs = extract_cost_slope_training_sample(project, db)
    if costs:
        sample = TrainingDataSample(
            project_id=project.id,
            domain="COST_SLOPES",
            anonymized_project_hash=project_hash,
            features=costs["features"],
            target_metrics=costs["target"],
            source_version="1.0.0",
        )
        db.add(sample)
        created_counts["COST_SLOPES"] += 1

    # 4. Extract Delay Recovery
    recovery = extract_delay_recovery_sample(project, db)
    if recovery:
        sample = TrainingDataSample(
            project_id=project.id,
            domain="DELAY_RECOVERY",
            anonymized_project_hash=project_hash,
            features=recovery["features"],
            target_metrics=recovery["target"],
            source_version="1.0.0",
        )
        db.add(sample)
        created_counts["DELAY_RECOVERY"] += 1

    # 5. Extract CV Vision Ground-Truth
    cv_list = extract_cv_vision_samples(project, db)
    for item in cv_list:
        sample = TrainingDataSample(
            project_id=project.id,
            domain="CV_CLASSIFIER",
            anonymized_project_hash=project_hash,
            features=item["features"],
            target_metrics=item["target"],
            source_version="1.0.0",
        )
        db.add(sample)
        created_counts["CV_CLASSIFIER"] += 1

    db.commit()
    return created_counts


def calibrate_ga_parameters(db: Session) -> Dict[str, Any]:
    """
    Analyzes consented empirical RCPSP graphs to calibrate Genetic Algorithm hyperparameters.
    """
    samples = db.query(TrainingDataSample).filter(TrainingDataSample.domain == "RCPSP_SCHEDULING").all()
    if not samples:
        return {
            "samples_analyzed": 0,
            "recommended_population_size": 40,
            "recommended_generations": 80,
            "recommended_mutation_rate": 0.20,
            "recommended_crossover_rate": 0.80,
            "empirical_basis": "Default baseline (no agreed training samples available yet)",
        }

    total_tasks = 0
    total_density = 0.0
    for s in samples:
        f = s.features or {}
        total_tasks += f.get("num_tasks", 20)
        total_density += f.get("graph_density", 0.15)

    n_avg = total_tasks / len(samples)
    density_avg = total_density / len(samples)

    # Adaptive heuristic rules
    pop_size = max(30, min(100, int(round(20 + 5 * math.sqrt(n_avg)))))
    generations = max(50, min(160, int(round(40 + 35 * (1.0 + density_avg)))))
    mutation_rate = round(max(0.10, min(0.35, 0.18 + 0.10 * density_avg)), 3)

    return {
        "samples_analyzed": len(samples),
        "average_tasks_per_project": round(n_avg, 1),
        "average_graph_density": round(density_avg, 4),
        "recommended_population_size": pop_size,
        "recommended_generations": generations,
        "recommended_mutation_rate": mutation_rate,
        "recommended_crossover_rate": 0.85,
        "empirical_basis": f"Calibrated across {len(samples)} consented project DAG networks",
    }


def export_training_dataset(db: Session, domain: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Exports clean, de-identified training corpora.
    Double-checks that project.data_sharing_consent is True.
    """
    query = (
        db.query(TrainingDataSample)
        .join(Project, TrainingDataSample.project_id == Project.id)
        .filter(Project.data_sharing_consent.is_(True))
    )
    if domain:
        query = query.filter(TrainingDataSample.domain == domain)

    samples = query.order_by(TrainingDataSample.created_at.desc()).all()
    return [
        {
            "sample_id": s.id,
            "domain": s.domain,
            "project_hash": s.anonymized_project_hash,
            "features": s.features,
            "target_metrics": s.target_metrics,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in samples
    ]
