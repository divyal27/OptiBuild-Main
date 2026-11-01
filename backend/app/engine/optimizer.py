from typing import Dict, List, Optional, Tuple
from backend.app.schemas.optimizer import (
    CrashableTaskItem,
    RERAPenaltyParams,
    CrashAction,
    OptimizationResult,
)
from backend.app.schemas.schedule import TaskItem
from backend.app.engine.cpm import CPMEngine


class DelayRecoveryOptimizer:
    """
    Computes statutory MahaRERA delay penalties (Sec 18: SBI MCLR + 200 bps)
    and executes greedy Critical Path Crashing (CPM Cost Slope Minimization)
    to recommend the lower-cost recovery strategy.
    """

    @staticmethod
    def calculate_rera_penalty(params: RERAPenaltyParams) -> Tuple[float, float, float]:
        """
        Calculates:
        - effective_annual_rate (%)
        - rera_daily_penalty (INR)
        - total_rera_penalty (INR)
        """
        effective_annual_rate = params.sbi_mclr_rate + params.rera_spread
        daily_rate_fraction = (effective_annual_rate / 100.0) / 365.0
        daily_penalty = round(params.total_allottee_investment * daily_rate_fraction, 2)
        total_penalty = round(daily_penalty * params.delay_days, 2)
        return effective_annual_rate, daily_penalty, total_penalty

    @classmethod
    def optimize_crashing(
        cls,
        tasks: List[CrashableTaskItem],
        target_days: int,
    ) -> Tuple[int, float, List[CrashAction]]:
        """
        Iteratively identifies the critical path and compresses the activity
        with the lowest crash cost slope until target recovery days are achieved
        or no further crashing is technically possible.
        """
        if target_days <= 0 or not tasks:
            return 0, 0.0, []

        # Current working durations and limits
        durations: Dict[str, int] = {t.id: t.normal_duration for t in tasks}
        min_durations: Dict[str, int] = {t.id: t.crash_duration for t in tasks}
        task_map: Dict[str, CrashableTaskItem] = {t.id: t for t in tasks}

        # Calculate cost slopes (cost per 1-day compression)
        cost_slopes: Dict[str, float] = {}
        for t in tasks:
            crashable_span = t.normal_duration - t.crash_duration
            if crashable_span > 0 and t.crash_cost >= t.normal_cost:
                cost_slopes[t.id] = (t.crash_cost - t.normal_cost) / crashable_span
            else:
                cost_slopes[t.id] = float("inf")

        days_shortened_per_task: Dict[str, int] = {t.id: 0 for t in tasks}
        days_recovered = 0
        total_crash_cost = 0.0

        for _ in range(target_days):
            # Compute CPM on current durations
            cpm_tasks = [
                TaskItem(
                    id=t.id,
                    name=t.name,
                    duration=durations[t.id],
                    predecessors=t.predecessors,
                )
                for t in tasks
            ]
            cpm_engine = CPMEngine(cpm_tasks)
            cpm_res = cpm_engine.compute()

            # Find critical tasks that still have crash capacity
            critical_candidates = [
                tid
                for tid in cpm_res.critical_path
                if durations[tid] > min_durations[tid] and cost_slopes[tid] < float("inf")
            ]

            if not critical_candidates:
                # No more critical tasks can be crashed
                break

            # Pick candidate with minimum cost slope
            best_task_id = min(critical_candidates, key=lambda tid: cost_slopes[tid])

            durations[best_task_id] -= 1
            days_shortened_per_task[best_task_id] += 1
            days_recovered += 1
            total_crash_cost += cost_slopes[best_task_id]

        # Build list of crashing actions taken
        actions: List[CrashAction] = []
        for t in tasks:
            shortened = days_shortened_per_task[t.id]
            if shortened > 0:
                cost = round(shortened * cost_slopes[t.id], 2)
                actions.append(
                    CrashAction(
                        task_id=t.id,
                        task_name=t.name,
                        original_duration=t.normal_duration,
                        new_duration=durations[t.id],
                        days_shortened=shortened,
                        cost_per_day=round(cost_slopes[t.id], 2),
                        total_additional_cost=cost,
                        reason=f"Compressed by {shortened}d on critical path at lowest marginal cost slope.",
                    )
                )

        return days_recovered, round(total_crash_cost, 2), actions

    @classmethod
    def evaluate(
        cls,
        rera_params: RERAPenaltyParams,
        tasks: List[CrashableTaskItem],
        target_recovery_days: Optional[int] = None,
    ) -> OptimizationResult:
        eff_rate, daily_pen, total_pen = cls.calculate_rera_penalty(rera_params)

        recovery_target = (
            target_recovery_days if target_recovery_days is not None else rera_params.delay_days
        )

        days_rec, total_crash_cost, actions = cls.optimize_crashing(tasks, recovery_target)

        # Decision rule: Recommend cheaper option accounting for feasibility & partial recovery
        avoided_penalty = round(days_rec * daily_pen, 2)
        remaining_penalty = round(max(0, recovery_target - days_rec) * daily_pen, 2)

        if recovery_target <= 0:
            recommendation = "ACCEPT_PENALTY"
            title = "NO DELAY DETECTED"
            net_savings = 0.0
            rationale = "Project is on schedule (0 days delay). No statutory MahaRERA delay penalty applies and no schedule crashing is required."
        elif days_rec == 0:
            recommendation = "ACCEPT_PENALTY"
            title = "ACCEPT RERA DELAY PENALTY (CRASHING INFEASIBLE)"
            net_savings = 0.0
            rationale = (
                f"Critical path activities have no remaining crash capacity (0 days recoverable). "
                f"Schedule compression is infeasible; developer must absorb statutory Section 18 penalty of ₹{total_pen:,.2f}."
            )
        elif total_crash_cost < avoided_penalty:
            recommendation = "CRASH_SCHEDULE"
            title = "CRASH SCHEDULE (RECOMMENDED)" if days_rec >= recovery_target else "PARTIAL CRASH (RECOMMENDED)"
            net_savings = round(avoided_penalty - total_crash_cost, 2)
            rationale = (
                f"Fast-tracking critical activities recovers {days_rec}d at ₹{total_crash_cost:,.2f}, saving "
                f"₹{net_savings:,.2f} against avoided statutory penalty of ₹{avoided_penalty:,.2f}."
                + (f" Remaining {recovery_target - days_rec}d incurs ₹{remaining_penalty:,.2f} penalty." if remaining_penalty > 0 else " This restores full RERA schedule compliance.")
            )
        else:
            recommendation = "ACCEPT_PENALTY"
            title = "ACCEPT RERA DELAY PENALTY"
            net_savings = round(total_crash_cost - avoided_penalty, 2)
            rationale = (
                f"Crashing {days_rec}d costs ₹{total_crash_cost:,.2f}, exceeding the avoidable "
                f"statutory penalty of ₹{avoided_penalty:,.2f} by ₹{net_savings:,.2f}. "
                f"It is financially rational to pay interest to allottees rather than expedite."
            )

        return OptimizationResult(
            delay_days=rera_params.delay_days,
            days_recovered=days_rec,
            effective_annual_rate=eff_rate,
            rera_daily_penalty=daily_pen,
            total_rera_penalty=total_pen,
            total_crash_cost=total_crash_cost,
            net_savings=net_savings,
            recommendation=recommendation,
            recommendation_title=title,
            rationale=rationale,
            crashing_actions=actions,
        )
