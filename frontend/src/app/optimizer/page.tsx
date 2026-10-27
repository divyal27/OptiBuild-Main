"use client"

import React, { useState, useEffect } from "react"
import { getApiUrl } from "@/lib/api"
import { TopBar } from "@/components/layout/TopBar"
import { EmptyState } from "@/components/ui/EmptyState"
import { PermissionDenied } from "@/components/ui/PermissionDenied"
import { useAuth } from "@/context/AuthContext"
import { formatINR } from "@/lib/utils"
import {
  Scale,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowRight,
  ShieldCheck,
  Calculator,
  Sliders,
  Loader2,
  Play,
} from "lucide-react"
import { motion } from "framer-motion"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"

interface CrashAction {
  task_id: string
  task_name: string
  original_duration: number
  new_duration: number
  days_shortened: number
  cost_per_day: number
  total_additional_cost: number
  reason: string
}

interface OptimizationState {
  delay_days: number
  days_recovered: number
  effective_annual_rate: number
  rera_daily_penalty: number
  total_rera_penalty: number
  total_crash_cost: number
  net_savings: number
  recommendation: "CRASH_SCHEDULE" | "ACCEPT_PENALTY" | string
  recommendation_title: string
  rationale: string
  crashing_actions: CrashAction[]
}

interface ProjectTask {
  id: string
  name: string
  duration: number
  normal_cost: number
  crash_cost: number
  crash_duration: number
  predecessors: string[]
  is_critical?: boolean
}

export default function OptimizerPage() {
  const { user, token, activeProjectId, activeProject, hasPermission } = useAuth()

  const [investmentCrores, setInvestmentCrores] = useState<number>(10.0)
  const [sbiMclr, setSbiMclr] = useState<number>(8.85)
  const [reraSpread, setReraSpread] = useState<number>(2.0)
  const [delayDays, setDelayDays] = useState<number>(14)
  const [tasks, setTasks] = useState<ProjectTask[]>([])

  const [result, setResult] = useState<OptimizationState | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isCalculating, setIsCalculating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch project tasks and optimizer record
  useEffect(() => {
    if (!activeProjectId || !token) {
      setIsLoading(false)
      return
    }

    const fetchProjectData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(getApiUrl(`/api/v1/projects/${activeProjectId}`), {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
          throw new Error("Failed to load project details.")
        }

        const data = await res.json()
        const projectTasks = data.tasks || []
        setTasks(projectTasks)

        // Seed parameter inputs from project
        if (data.total_allottee_investment) {
          setInvestmentCrores(Number((data.total_allottee_investment / 10000000).toFixed(2)))
        } else if (data.total_project_cost) {
          setInvestmentCrores(Number(((data.total_project_cost * 0.7) / 10000000).toFixed(2)))
        }

        if (data.sbi_mclr_rate) {
          setSbiMclr(Number((data.sbi_mclr_rate * 100).toFixed(2)))
        }
        if (data.rera_spread) {
          setReraSpread(Number((data.rera_spread * 100).toFixed(2)))
        }
        if (data.delay_days) {
          setDelayDays(data.delay_days)
        }

        if (data.optimizer_data) {
          setResult(data.optimizer_data)
        } else {
          setResult(null)
        }
      } catch (err: any) {
        console.error(err)
        setError(err.message || "Failed to load project optimization data.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjectData()
  }, [activeProjectId, token])

  const handleRecalculate = async () => {
    if (!activeProjectId || !token || tasks.length === 0) return
    setIsCalculating(true)
    setError(null)

    const investmentInr = investmentCrores * 10000000

    try {
      // 1. Try evaluating via the custom evaluate endpoint with active project tasks
      const crashableTasks = tasks.map((t) => ({
        id: t.id,
        name: t.name,
        normal_duration: t.duration,
        crash_duration: t.crash_duration || Math.max(1, Math.floor(t.duration * 0.65)),
        normal_cost: t.normal_cost || 100000,
        crash_cost: t.crash_cost || (t.normal_cost ? t.normal_cost * 1.35 : 135000),
        predecessors: t.predecessors || [],
      }))

      const res = await fetch(getApiUrl("/api/v1/optimizer/evaluate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rera_params: {
            total_allottee_investment: investmentInr,
            sbi_mclr_rate: sbiMclr,
            rera_spread: reraSpread,
            delay_days: delayDays,
          },
          tasks: crashableTasks,
          target_recovery_days: delayDays,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setResult(data)
        // Also persist to project in background
        fetch(getApiUrl(`/api/v1/projects/${activeProjectId}/optimizer?target_recovery_days=${delayDays}`), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null)
      } else {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Optimization calculation failed.")
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to calculate optimization.")
    } finally {
      setIsCalculating(false)
    }
  }

  // Permission check
  if (!hasPermission(["admin", "project_manager", "owner"])) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar projectName="Delay Penalty vs Crashing Cost Optimizer" />
        <main className="p-6">
          <PermissionDenied
            title="Access Restricted"
            description="MahaRERA delay penalty calculation and schedule crashing optimization is restricted to Project Managers, Owners, and Administrators."
            requiredRoles={["admin", "project_manager", "owner"]}
          />
        </main>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar projectName="Delay Penalty vs Crashing Cost Optimizer" />
        <div className="flex flex-col items-center justify-center p-16 font-mono text-xs text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
          Loading project tasks and penalty parameters...
        </div>
      </div>
    )
  }

  // No active project
  if (!activeProjectId) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar projectName="Delay Penalty vs Crashing Cost Optimizer" />
        <main className="p-6">
          <EmptyState
            title="No Active Project Selected"
            description="Select or upload a MahaRERA project from the sidebar to evaluate statutory delay penalties against schedule crashing costs."
            actionLabel="Upload MahaRERA PDF"
            actionHref="/rera-review"
          />
        </main>
      </div>
    )
  }

  // No tasks
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar projectName={activeProject?.name || "Delay Penalty vs Crashing Cost Optimizer"} />
        <main className="p-6">
          <EmptyState
            title="No Scheduled Activities Found"
            description="This project does not have a Work Breakdown Structure or activities yet. Generate a WBS and schedule first to compute compression cost slopes."
            actionLabel="Generate WBS & Cost Estimate"
            actionHref="/wbs"
          />
        </main>
      </div>
    )
  }

  const isCrashCheaper = result ? result.recommendation === "CRASH_SCHEDULE" : false

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        projectName={activeProject?.name || "MahaRERA Delay Penalty vs Crashing Cost Optimizer"}
        delayRiskDays={delayDays}
        onRecalculate={handleRecalculate}
        isOptimizing={isCalculating}
      />

      <main className="p-4 md:p-6 space-y-6 max-w-7xl">
        {/* Statutory Formula Banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="border border-border bg-card p-4 rounded-[4px] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
        >
          <div>
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              <h2 className="font-heading font-semibold text-sm text-foreground uppercase tracking-wider">
                MahaRERA Section 18 Statutory Rule Optimizer
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              Statutory Formula: Delay Penalty = Total Allottee Collections × [ (SBI MCLR + 2.0%) / 365 ] × Delay Days
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono px-2.5 py-1 bg-secondary border border-border text-foreground rounded-[4px]">
              Statutory Rate: {(sbiMclr + reraSpread).toFixed(2)}% p.a.
            </span>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleRecalculate}
              disabled={isCalculating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-mono text-xs font-medium hover:bg-primary/90 transition-colors border border-primary rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Evaluate Strategy
                </>
              )}
            </motion.button>
          </div>
        </motion.div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive text-destructive font-mono text-xs flex items-center gap-2 rounded-[4px]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Input Controls Grid */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-3 border border-border bg-card p-4 rounded-[4px] shadow-sm"
        >
          <div>
            <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1 font-semibold">
              Allottee Investment (₹ Cr)
            </label>
            <input
              type="number"
              step="0.25"
              min="0.5"
              value={investmentCrores}
              onChange={(e) => setInvestmentCrores(parseFloat(e.target.value) || 0)}
              className="w-full text-xs font-mono bg-background border border-border p-2 text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
            />
            <span className="text-[10px] font-mono text-muted-foreground mt-1 block">
              {formatINR(investmentCrores * 10000000)}
            </span>
          </div>

          <div>
            <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1 font-semibold">
              SBI MCLR Benchmark (%)
            </label>
            <input
              type="number"
              step="0.05"
              value={sbiMclr}
              onChange={(e) => setSbiMclr(parseFloat(e.target.value) || 0)}
              className="w-full text-xs font-mono bg-background border border-border p-2 text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
            />
            <span className="text-[10px] font-mono text-muted-foreground mt-1 block">
              Highest Marginal Cost
            </span>
          </div>

          <div>
            <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1 font-semibold">
              RERA Spread (%)
            </label>
            <input
              type="number"
              step="0.25"
              value={reraSpread}
              onChange={(e) => setReraSpread(parseFloat(e.target.value) || 0)}
              className="w-full text-xs font-mono bg-background border border-border p-2 text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
            />
            <span className="text-[10px] font-mono text-muted-foreground mt-1 block">
              Prescribed: +200 bps
            </span>
          </div>

          <div>
            <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1 font-semibold">
              Forecasted Delay (Days)
            </label>
            <input
              type="number"
              min="1"
              max="180"
              value={delayDays}
              onChange={(e) => setDelayDays(parseInt(e.target.value) || 0)}
              className="w-full text-xs font-mono bg-background border border-border p-2 text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
            />
            <span className="text-[10px] font-mono text-muted-foreground mt-1 block">
              Calendar days behind
            </span>
          </div>
        </motion.div>

        {/* Results View or Prompt to Run */}
        {!result ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="border border-dashed border-border bg-card/50 p-8 text-center space-y-3 rounded-[4px]"
          >
            <Calculator className="w-8 h-8 text-primary mx-auto opacity-75" />
            <h3 className="font-heading font-semibold text-sm text-foreground">
              Ready to Evaluate Delay Trade-offs
            </h3>
            <p className="text-xs font-mono text-muted-foreground max-w-md mx-auto">
              Compare the statutory MahaRERA interest liability against crashing activities on the critical path
              for the {tasks.length} tasks in {activeProject?.name}.
            </p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleRecalculate}
              disabled={isCalculating}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-mono text-xs font-medium hover:bg-primary/90 transition-colors border border-primary rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Run Delay vs Crashing Analysis
                </>
              )}
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="space-y-6"
          >
            {/* Comparison Result Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Option A: Accept MahaRERA Delay Penalty */}
              <div
                className={`border p-5 rounded-[4px] transition-colors shadow-sm ${
                  !isCrashCheaper
                    ? "border-status-success bg-status-success/[0.04] ring-1 ring-status-success/30"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
                    OPTION A • ACCEPT RERA PENALTY
                  </span>
                  {!isCrashCheaper && (
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-status-success/15 border border-status-success/30 text-status-success font-bold flex items-center gap-1 rounded-[4px]">
                      <CheckCircle2 className="w-3 h-3" /> CHEAPER STRATEGY
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <span className="text-[11px] font-mono text-muted-foreground block font-medium">
                    Total Statutory Liability
                  </span>
                  <div className="mt-1 text-3xl font-mono font-bold text-foreground">
                    <AnimatedNumber
                      value={result.total_rera_penalty}
                      formatter={(v) => formatINR(v)}
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-xs font-mono text-muted-foreground border-t border-border/50 pt-3">
                  <div className="flex justify-between items-center">
                    <span>Daily Interest Rate:</span>
                    <span className="text-foreground font-medium">
                      <AnimatedNumber
                        value={result.rera_daily_penalty}
                        formatter={(v) => `${formatINR(v)} / day`}
                      />
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Applicable Annual Rate:</span>
                    <span className="text-foreground font-medium">{result.effective_annual_rate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Direct Allottee Liability:</span>
                    <span className="text-foreground font-medium">{delayDays} days interest</span>
                  </div>
                </div>
              </div>

              {/* Option B: Fast-Track Schedule Crashing */}
              <div
                className={`border p-5 rounded-[4px] transition-colors shadow-sm ${
                  isCrashCheaper
                    ? "border-status-success bg-status-success/[0.04] ring-1 ring-status-success/30"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
                    OPTION B • CRASH SCHEDULE (EXPEDITE)
                  </span>
                  {isCrashCheaper && (
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-status-success/15 border border-status-success/30 text-status-success font-bold flex items-center gap-1 rounded-[4px]">
                      <CheckCircle2 className="w-3 h-3" /> CHEAPER STRATEGY
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <span className="text-[11px] font-mono text-muted-foreground block font-medium">
                    Total Additional Crashing Cost
                  </span>
                  <div className="mt-1 text-3xl font-mono font-bold text-primary">
                    <AnimatedNumber
                      value={result.total_crash_cost}
                      formatter={(v) => formatINR(v)}
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2 text-xs font-mono text-muted-foreground border-t border-border/50 pt-3">
                  <div className="flex justify-between items-center">
                    <span>Days Recovered:</span>
                    <span className="text-status-success font-bold">-{result.days_recovered} days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Crashing Actions:</span>
                    <span className="text-foreground font-medium">
                      {result.crashing_actions ? result.crashing_actions.length : 0} activities compressed
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Net Financial Savings:</span>
                    <span className="text-status-success font-bold">
                      <AnimatedNumber
                        value={result.net_savings}
                        formatter={(v) => formatINR(v)}
                      />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Decision Card */}
            <div className="border border-border bg-secondary/60 p-4 rounded-[4px] shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h3 className="font-heading font-semibold text-xs text-foreground uppercase tracking-wider">
                  OPTIMIZER RECOMMENDATION: {result.recommendation_title}
                </h3>
              </div>
              <p className="mt-2 text-xs text-foreground leading-relaxed font-sans">
                {result.rationale}
              </p>
            </div>

            {/* Crashing Execution Plan Table */}
            {result.crashing_actions && result.crashing_actions.length > 0 && (
              <div className="border border-border bg-card rounded-[4px] shadow-sm overflow-hidden">
                <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between">
                  <div>
                    <h3 className="font-heading font-semibold text-xs text-foreground uppercase tracking-wider">
                      CRITICAL PATH CRASHING BREAKDOWN (LOWEST COST SLOPE ORDER)
                    </h3>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Optimal sequence of activity compression calculated via CPM cost-slope minimization
                    </p>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 border border-border bg-background rounded-[4px] font-semibold text-primary">
                    TOTAL RECOVERED: {result.days_recovered} DAYS
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] text-muted-foreground uppercase">
                        <th className="p-2.5 font-semibold">Activity ID</th>
                        <th className="p-2.5 font-semibold">Task Name</th>
                        <th className="p-2.5 font-semibold text-right">Normal Dur</th>
                        <th className="p-2.5 font-semibold text-right">Crashed Dur</th>
                        <th className="p-2.5 font-semibold text-right">Shortened</th>
                        <th className="p-2.5 font-semibold text-right">Cost Slope</th>
                        <th className="p-2.5 font-semibold text-right">Expenditure</th>
                        <th className="p-2.5 font-semibold">Implementation Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {result.crashing_actions.map((act) => (
                        <tr key={act.task_id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-2.5 font-bold text-foreground">{act.task_id}</td>
                          <td className="p-2.5 font-sans font-medium text-foreground">{act.task_name}</td>
                          <td className="p-2.5 text-right text-muted-foreground">{act.original_duration}d</td>
                          <td className="p-2.5 text-right font-bold text-primary">{act.new_duration}d</td>
                          <td className="p-2.5 text-right font-bold text-status-success">-{act.days_shortened}d</td>
                          <td className="p-2.5 text-right text-muted-foreground">{formatINR(act.cost_per_day)}/d</td>
                          <td className="p-2.5 text-right font-bold text-foreground">
                            {formatINR(act.total_additional_cost)}
                          </td>
                          <td className="p-2.5 text-[11px] text-muted-foreground">{act.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  )
}
