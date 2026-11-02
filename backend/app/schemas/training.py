from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class ConsentUpdateRequest(BaseModel):
    data_sharing_consent: bool = Field(
        ...,
        description="Explicit agreement to contribute anonymized project graph and cost telemetry to train OptiBuild algorithms."
    )
    anonymized_telemetry_opt_in: Optional[bool] = Field(
        default=False,
        description="Whether high-frequency solver iteration runtime and heuristic telemetry are included."
    )


class ConsentStatusResponse(BaseModel):
    project_id: str
    project_name: str
    data_sharing_consent: bool
    consent_given_at: Optional[str] = None
    consent_by_id: Optional[str] = None
    anonymized_telemetry_opt_in: bool
    legal_framework: str = "Digital Personal Data Protection Act (DPDP), 2023 Compliant"
    privacy_guarantee: str = "Strictly de-identified. Architectural CAD drawings and invoice bill photos are excluded by architectural invariants INV-2 and INV-3."


class DomainSampleCount(BaseModel):
    domain: str
    sample_count: int
    description: str


class TrainingOverviewResponse(BaseModel):
    total_projects: int
    consented_projects: int
    consent_rate_percent: float
    total_training_samples: int
    domain_breakdown: List[DomainSampleCount]
    dpdp_compliance_status: str
    last_harvested_at: Optional[str] = None


class HarvestResponse(BaseModel):
    harvested_projects_count: int
    samples_created: int
    samples_by_domain: Dict[str, int]
    message: str


class CalibrateEngineResponse(BaseModel):
    total_samples_analyzed: int
    recommended_ga_hyperparameters: Dict[str, Any]
    empirical_cost_slope_inflation: Dict[str, float]
    cv_ground_truth_samples: int
    status: str
