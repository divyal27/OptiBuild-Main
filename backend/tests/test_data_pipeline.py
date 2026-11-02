import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.db.models import (
    Base,
    Organization,
    User,
    Project,
    TaskModel,
    MaterialLogModel,
    SitePhotoModel,
    DelayRecoveryEvaluationModel,
    TrainingDataSample,
)
from backend.app.engine.data_pipeline import (
    generate_anonymized_project_hash,
    sanitize_project_metadata,
    harvest_consented_project,
    calibrate_ga_parameters,
    export_training_dataset,
)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    user = User(
        id="usr-test",
        email="test_pm@optibuild.io",
        hashed_password="hashed_dummy",
        full_name="Test PM",
        role="project_manager",
    )
    session.add(user)
    session.commit()

    yield session
    session.close()


def test_hash_anonymization():
    project_id = "proj-12345"
    h1 = generate_anonymized_project_hash(project_id)
    h2 = generate_anonymized_project_hash(project_id)
    assert h1 == h2
    assert len(h1) == 32
    assert "proj-12345" not in h1


def test_unconsented_project_harvest_blocked(db_session):
    project = Project(
        id="proj-unconsented",
        name="Private Luxury Towers",
        promoter_name="Confidential Promoter Ltd",
        data_sharing_consent=False,
    )
    db_session.add(project)
    db_session.commit()

    with pytest.raises(PermissionError) as exc_info:
        harvest_consented_project(project.id, db_session)
    assert "data_sharing_consent is False" in str(exc_info.value)

    samples = db_session.query(TrainingDataSample).filter(TrainingDataSample.project_id == project.id).all()
    assert len(samples) == 0


def test_consented_project_harvest_success(db_session):
    project = Project(
        id="proj-consented-1",
        name="Skyline Park",
        promoter_name="Skyline Corp",
        built_up_area_sqft=60000.0,
        number_of_floors=12,
        number_of_basements=1,
        total_project_cost=150000000.0,
        total_allottee_investment=100000000.0,
        data_sharing_consent=True,
        consent_given_at=datetime.utcnow(),
    )
    db_session.add(project)

    t1 = TaskModel(id="T01", project_id=project.id, name="Excavation", duration=10, normal_cost=50000, is_critical=True)
    t2 = TaskModel(id="T02", project_id=project.id, name="PCC", duration=8, normal_cost=70000, predecessors=["T01"], is_critical=True)
    db_session.add_all([t1, t2])

    mat = MaterialLogModel(
        entry_id="mat-01",
        project_id=project.id,
        date="2026-10-01",
        material_category="Steel",
        item_description="Fe500D TMT Rebar",
        quantity=20.0,
        unit="MT",
        unit_rate=56000.0,
        total_amount=1120000.0,
        supplier_name="Tata Steel",
        invoice_no="INV-1092",
    )
    db_session.add(mat)

    eval_record = DelayRecoveryEvaluationModel(
        id="eval-01",
        project_id=project.id,
        delay_days=10,
        rera_daily_penalty=30000.0,
        rera_total_penalty=300000.0,
        total_crash_cost=180000.0,
        days_recovered=8,
        net_savings=120000.0,
        recommendation="CRASH",
    )
    db_session.add(eval_record)

    photo = SitePhotoModel(
        id="photo-01",
        project_id=project.id,
        photo_url="https://minio/photo.jpg",
        predicted_stage="STRUCTURAL_STAGE",
        stage_label="RCC Frame",
        confidence_score=0.88,
        detected_features={"edge_density": 0.42, "color_gray": 0.65},
        engineer_confirmed_stage="STRUCTURAL_STAGE",
    )
    db_session.add(photo)
    db_session.commit()

    # Harvest
    counts = harvest_consented_project(project.id, db_session)
    assert counts["RCPSP_SCHEDULING"] == 1
    assert counts["COST_SLOPES"] == 1
    assert counts["DELAY_RECOVERY"] == 1
    assert counts["CV_CLASSIFIER"] == 1

    # Verify no PII leaked in samples
    samples = db_session.query(TrainingDataSample).filter(TrainingDataSample.project_id == project.id).all()
    assert len(samples) == 4
    for s in samples:
        features_str = str(s.features)
        assert "Skyline Corp" not in features_str
        assert "Tata Steel" not in features_str
        assert "INV-1092" not in features_str
        assert s.anonymized_project_hash is not None


def test_ga_calibration_logic(db_session):
    project = Project(
        id="proj-for-ga",
        name="Commercial Complex",
        data_sharing_consent=True,
    )
    db_session.add(project)
    sample = TrainingDataSample(
        id="s-ga-1",
        project_id=project.id,
        domain="RCPSP_SCHEDULING",
        anonymized_project_hash="hash123",
        features={"num_tasks": 30, "graph_density": 0.20},
        target_metrics={"makespan": 120},
    )
    db_session.add(sample)
    db_session.commit()

    params = calibrate_ga_parameters(db_session)
    assert params["samples_analyzed"] == 1
    assert 30 <= params["recommended_population_size"] <= 100
    assert 50 <= params["recommended_generations"] <= 160
    assert 0.10 <= params["recommended_mutation_rate"] <= 0.35


def test_export_training_dataset(db_session):
    project = Project(id="proj-exp", name="P1", data_sharing_consent=True)
    db_session.add(project)
    sample = TrainingDataSample(
        id="s-exp-1",
        project_id=project.id,
        domain="RCPSP_SCHEDULING",
        anonymized_project_hash="hashexp",
        features={"num_tasks": 10},
        target_metrics={"makespan": 45},
    )
    db_session.add(sample)
    db_session.commit()

    exported = export_training_dataset(db_session)
    assert len(exported) >= 1
    assert exported[0]["domain"] == "RCPSP_SCHEDULING"
    assert exported[0]["project_hash"] == "hashexp"
