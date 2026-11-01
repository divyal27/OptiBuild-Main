import pytest
from starlette.testclient import TestClient
from backend.app.schemas.optimizer import (
    CrashableTaskItem,
    RERAPenaltyParams,
)
from backend.app.engine.optimizer import DelayRecoveryOptimizer
from backend.app.main import app

client = TestClient(app)


def test_rera_penalty_calculation():
    """Validates statutory interest calculation under MahaRERA Sec 18 (SBI MCLR + 2%)."""
    # 10 Crore collected, 8.85% MCLR + 2.0% = 10.85% annual
    params = RERAPenaltyParams(
        total_allottee_investment=100000000.0,
        sbi_mclr_rate=8.85,
        rera_spread=2.00,
        delay_days=10,
    )

    eff_rate, daily_pen, total_pen = DelayRecoveryOptimizer.calculate_rera_penalty(params)

    assert eff_rate == 10.85
    # Daily penalty = 100,000,000 * (0.1085 / 365) = 29,726.03
    assert abs(daily_pen - 29726.03) < 1.0
    assert abs(total_pen - 297260.27) < 2.0


def test_greedy_crashing_selects_lowest_slope():
    """Verifies that the optimizer compresses the task with the lowest marginal crash slope."""
    tasks = [
        # T1: Normal 10d @ 100k, Crash 7d @ 130k -> slope = 30k / 3d = 10,000 / day
        CrashableTaskItem(
            id="T1",
            name="Excavation",
            normal_duration=10,
            crash_duration=7,
            normal_cost=100000.0,
            crash_cost=130000.0,
            predecessors=[],
        ),
        # T2: Normal 10d @ 200k, Crash 6d @ 320k -> slope = 120k / 4d = 30,000 / day
        CrashableTaskItem(
            id="T2",
            name="Foundation",
            normal_duration=10,
            crash_duration=6,
            normal_cost=200000.0,
            crash_cost=320000.0,
            predecessors=["T1"],
        ),
    ]

    # Target 2 days compression
    days_rec, cost, actions = DelayRecoveryOptimizer.optimize_crashing(tasks, target_days=2)

    assert days_rec == 2
    # Should only compress T1 since its slope is 10k/day vs T2's 30k/day
    assert cost == 20000.0
    assert len(actions) == 1
    assert actions[0].task_id == "T1"
    assert actions[0].days_shortened == 2


def test_recommendation_crash_cheaper():
    """When crashing costs less than statutory penalty, recommends CRASH_SCHEDULE."""
    params = RERAPenaltyParams(
        total_allottee_investment=50000000.0,  # 5 Cr
        sbi_mclr_rate=8.85,
        rera_spread=2.00,
        delay_days=14,  # Penalty ~ 2,08,000
    )
    tasks = [
        CrashableTaskItem(
            id="T1",
            name="Structural Slab",
            normal_duration=20,
            crash_duration=10,
            normal_cost=500000.0,
            crash_cost=550000.0,  # Slope = 50k / 10d = 5k/day -> 14d = 70,000
            predecessors=[],
        ),
    ]

    res = DelayRecoveryOptimizer.evaluate(params, tasks)

    assert res.recommendation == "CRASH_SCHEDULE"
    assert res.total_crash_cost < res.total_rera_penalty
    assert res.net_savings > 0


def test_recommendation_penalty_cheaper():
    """When expediting/crashing is exorbitant, recommends ACCEPT_PENALTY."""
    params = RERAPenaltyParams(
        total_allottee_investment=5000000.0,  # 50 Lakh
        sbi_mclr_rate=8.85,
        rera_spread=2.00,
        delay_days=5,  # Penalty ~ 7,430
    )
    tasks = [
        CrashableTaskItem(
            id="T1",
            name="Specialist Waterproofing",
            normal_duration=10,
            crash_duration=5,
            normal_cost=100000.0,
            crash_cost=500000.0,  # Slope = 400k / 5d = 80,000 / day -> 5d = 400,000
            predecessors=[],
        ),
    ]

    res = DelayRecoveryOptimizer.evaluate(params, tasks)

    assert res.recommendation == "ACCEPT_PENALTY"
    assert res.total_crash_cost > res.total_rera_penalty
    assert res.net_savings > 0


def test_optimizer_api_endpoint():
    """Verifies POST /api/v1/optimizer/evaluate API call."""
    payload = {
        "rera_params": {
            "total_allottee_investment": 20000000.0,
            "sbi_mclr_rate": 8.85,
            "rera_spread": 2.0,
            "delay_days": 7,
        },
        "tasks": [
            {
                "id": "A",
                "name": "Blockwork",
                "normal_duration": 14,
                "crash_duration": 7,
                "normal_cost": 80000.0,
                "crash_cost": 115000.0,
                "predecessors": [],
            }
        ],
    }
    resp = client.post("/api/v1/optimizer/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "recommendation" in data
    assert "total_rera_penalty" in data
    assert "total_crash_cost" in data
    assert "crashing_actions" in data


def test_uncrashable_schedule_recommends_accept_penalty():
    """
    Beyonce Rule: When all tasks on critical path are already at minimum crash duration
    (0 days recovered), optimizer must NOT recommend CRASH_SCHEDULE at 0 cost.
    It must recommend ACCEPT_PENALTY because crashing is infeasible.
    """
    params = RERAPenaltyParams(
        total_allottee_investment=10000000.0,
        sbi_mclr_rate=8.85,
        rera_spread=2.00,
        delay_days=10,
    )
    tasks = [
        CrashableTaskItem(
            id="T1",
            name="Excavation",
            normal_duration=10,
            crash_duration=10,
            normal_cost=100000.0,
            crash_cost=100000.0,
            predecessors=[],
        ),
    ]

    res = DelayRecoveryOptimizer.evaluate(params, tasks)

    assert res.days_recovered == 0
    assert res.recommendation == "ACCEPT_PENALTY"
    assert "INFEASIBLE" in res.recommendation_title


def test_zero_delay_days_recommends_no_delay():
    """Validates that a project with 0 delay days correctly reports NO DELAY DETECTED."""
    params = RERAPenaltyParams(
        total_allottee_investment=10000000.0,
        sbi_mclr_rate=8.85,
        rera_spread=2.00,
        delay_days=0,
    )
    tasks = [
        CrashableTaskItem(
            id="T1",
            name="Excavation",
            normal_duration=10,
            crash_duration=5,
            normal_cost=100000.0,
            crash_cost=150000.0,
            predecessors=[],
        ),
    ]

    res = DelayRecoveryOptimizer.evaluate(params, tasks)
    assert res.days_recovered == 0
    assert res.total_rera_penalty == 0.0
    assert res.recommendation == "ACCEPT_PENALTY"
    assert "NO DELAY DETECTED" in res.recommendation_title
