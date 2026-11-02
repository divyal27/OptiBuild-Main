import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship
from backend.app.db.session import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    projects = relationship("Project", back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="site_engineer")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project_memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(50), primary_key=True, index=True, default=generate_uuid)
    organization_id = Column(String(50), ForeignKey("organizations.id"), nullable=True)
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="ACTIVE")
    
    # RERA & Physical parameters
    rera_registration_no = Column(String(100), nullable=True, index=True)
    promoter_name = Column(String(255), nullable=True)
    proposed_completion_date = Column(String(50), nullable=True)
    plot_area_sqft = Column(Float, default=0.0)
    built_up_area_sqft = Column(Float, default=0.0)
    carpet_area_sqft = Column(Float, default=0.0)
    number_of_floors = Column(Integer, default=0)
    number_of_basements = Column(Integer, default=0)
    base_rate_per_sqft = Column(Float, default=2400.0)
    total_project_cost = Column(Float, default=0.0)
    
    # Financial & Delay parameters
    total_allottee_investment = Column(Float, default=0.0)
    sbi_mclr_rate = Column(Float, default=0.0885)
    rera_spread = Column(Float, default=0.02)
    delay_days = Column(Integer, default=0)
    
    # Stored computation outputs per project
    wbs_data = Column(JSON, nullable=True)
    schedule_data = Column(JSON, nullable=True)
    optimizer_data = Column(JSON, nullable=True)
    benchmark_data = Column(JSON, nullable=True)

    # Privacy, Consent & Algorithmic Training (DPDP Act 2023 Compliant)
    data_sharing_consent = Column(Boolean, default=False, nullable=False)
    consent_given_at = Column(DateTime, nullable=True)
    consent_by_id = Column(String(50), ForeignKey("users.id"), nullable=True)
    anonymized_telemetry_opt_in = Column(Boolean, default=False, nullable=False)

    created_by_id = Column(String(50), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization", back_populates="projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("TaskModel", back_populates="project", cascade="all, delete-orphan")
    materials = relationship("MaterialLogModel", back_populates="project", cascade="all, delete-orphan")
    drawings = relationship("ProjectDrawing", back_populates="project", cascade="all, delete-orphan")
    site_photos = relationship("SitePhotoModel", back_populates="project", cascade="all, delete-orphan")
    feedback_reports = relationship("FeedbackReportModel", back_populates="project", cascade="all, delete-orphan")
    training_samples = relationship("TrainingDataSample", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    project_id = Column(String(50), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")


class TaskModel(Base):
    __tablename__ = "tasks"

    id = Column(String(50), primary_key=True, index=True)
    project_id = Column(String(50), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    duration = Column(Integer, nullable=False, default=1)
    normal_cost = Column(Float, default=0.0)
    crash_cost = Column(Float, default=0.0)
    crash_duration = Column(Integer, nullable=True)
    predecessors = Column(JSON, default=list)
    resource_demands = Column(JSON, default=dict)
    is_critical = Column(Boolean, default=False)
    total_float = Column(Integer, default=0)
    free_float = Column(Integer, default=0)
    progress_percent = Column(Float, default=0.0)
    status = Column(String(50), default="NOT_STARTED")  # NOT_STARTED, IN_PROGRESS, COMPLETED
    actual_start = Column(String(50), nullable=True)
    actual_finish = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="tasks")


class MaterialLogModel(Base):
    __tablename__ = "material_logs"

    entry_id = Column(String(50), primary_key=True, index=True)
    project_id = Column(String(50), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    date = Column(String(20), nullable=False)
    material_category = Column(String(100), nullable=False)
    item_description = Column(Text, nullable=True)
    wbs_code = Column(String(50), nullable=True)
    quantity = Column(Float, nullable=False)
    unit = Column(String(50), nullable=False)
    unit_rate = Column(Float, nullable=False)
    total_amount = Column(Float, nullable=False)
    supplier_name = Column(String(255), nullable=False)
    invoice_no = Column(String(100), nullable=False)
    bill_attachment_url = Column(Text, nullable=True)  # LOCKED RULE: stored as unparsed evidence
    logged_by_id = Column(String(50), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="materials")


class ProjectDrawing(Base):
    __tablename__ = "project_drawings"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    project_id = Column(String(50), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    drawing_type = Column(String(100), default="ARCHITECTURAL")  # ARCHITECTURAL, STRUCTURAL, MEP
    file_name = Column(String(255), nullable=False)
    file_url = Column(Text, nullable=False)  # LOCKED RULE: stored for viewing, never parsed
    uploaded_by_id = Column(String(50), ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="drawings")


class RERACertificateModel(Base):
    __tablename__ = "rera_certificates"

    id = Column(String(50), primary_key=True, index=True, default=generate_uuid)
    project_id = Column(String(50), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    rera_registration_no = Column(String(100), nullable=False, index=True)
    project_name = Column(String(255), nullable=False)
    promoter_name = Column(String(255), nullable=True)
    proposed_completion_date = Column(String(50), nullable=True)
    plot_area_sqft = Column(Float, nullable=True)
    built_up_area_sqft = Column(Float, nullable=True)
    carpet_area_sqft = Column(Float, nullable=True)
    number_of_floors = Column(Integer, nullable=True)
    number_of_basements = Column(Integer, nullable=True)
    total_project_cost = Column(Float, nullable=True)
    status = Column(String(50), default="CONFIRMED")
    raw_pdf_url = Column(Text, nullable=True)
    confirmed_at = Column(DateTime, default=datetime.utcnow)


class SitePhotoModel(Base):
    __tablename__ = "site_photos"

    id = Column(String(50), primary_key=True, index=True, default=generate_uuid)
    project_id = Column(String(50), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    photo_url = Column(Text, nullable=False)
    predicted_stage = Column(String(50), nullable=False)
    stage_label = Column(String(255), nullable=False)
    confidence_score = Column(Float, nullable=False)
    detected_features = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    engineer_confirmed_stage = Column(String(50), nullable=True)
    uploaded_by_id = Column(String(50), ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="site_photos")


class DelayRecoveryEvaluationModel(Base):
    __tablename__ = "delay_recovery_evaluations"

    id = Column(String(50), primary_key=True, index=True, default=generate_uuid)
    project_id = Column(String(50), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    delay_days = Column(Integer, nullable=False)
    rera_daily_penalty = Column(Float, nullable=False)
    rera_total_penalty = Column(Float, nullable=False)
    total_crash_cost = Column(Float, nullable=False)
    days_recovered = Column(Integer, nullable=False)
    net_savings = Column(Float, nullable=False)
    recommendation = Column(String(50), nullable=False)
    crashing_actions = Column(JSON, nullable=True)
    evaluated_at = Column(DateTime, default=datetime.utcnow)


class FeedbackReportModel(Base):
    __tablename__ = "feedback_reports"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    report_type = Column(String(20), nullable=False, index=True)  # BUG, FEEDBACK, FEATURE_REQUEST
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False, default="GENERAL")
    severity = Column(String(20), default="MEDIUM")
    rating = Column(Integer, nullable=True)
    status = Column(String(30), default="OPEN", index=True)
    telemetry_data = Column(JSON, nullable=True)
    attachment_url = Column(Text, nullable=True)
    jira_issue_key = Column(String(50), nullable=True, index=True)
    submitted_by_id = Column(String(50), ForeignKey("users.id"), nullable=True)
    project_id = Column(String(50), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="feedback_reports")
    submitted_by = relationship("User", foreign_keys=[submitted_by_id])


class TrainingDataSample(Base):
    __tablename__ = "training_data_samples"

    id = Column(String(50), primary_key=True, default=generate_uuid)
    project_id = Column(String(50), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    domain = Column(String(50), nullable=False, index=True)  # RCPSP_SCHEDULING, COST_SLOPES, DELAY_RECOVERY, CV_CLASSIFIER
    anonymized_project_hash = Column(String(64), nullable=False, index=True)
    features = Column(JSON, nullable=False)
    target_metrics = Column(JSON, nullable=False)
    source_version = Column(String(20), default="1.0.0")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="training_samples")
