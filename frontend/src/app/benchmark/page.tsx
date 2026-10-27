"use client"

import React, { useState, useEffect } from "react"
import { getApiUrl } from "@/lib/api"
import { TopBar } from "@/components/layout/TopBar"
import { EmptyState } from "@/components/ui/EmptyState"
import { PermissionDenied } from "@/components/ui/PermissionDenied"
import { useAuth } from "@/context/AuthContext"
import {
  Cpu,
  BarChart2,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  Clock,
  ArrowRight,
  Code,
  Layers,
  Loader2,
  Play,
  AlertTriangle,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"

interface SolverMetrics {
  solver_name: string
  status: string
  makespan_days: number
  runtime_ms: number
}

interface BenchmarkData {
  benchmark_name: string
  task_count: number
  resource_limits: Record<string, number>
  ga_metrics: SolverMetrics
  cpsat_metrics: SolverMetrics
  optimality_gap_percent: number
  cpsat_is_optimal: boolean
  markdown_table: string
}

export default function BenchmarkPage() {
  const { user, token, activeProjectId, activeProject, hasPermission } = useAuth()

  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<string>("active_project")
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [hasProjectTasks, setHasProjectTasks] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedMd, setCopiedMd] = useState<boolean>(false)
  const [copiedJson, setCopiedJson] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<"table" | "json">("table")

  // Load project benchmark or presets
  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    const checkProject = async () => {
      setIsLoading(true)
      setError(null)
      try {
        if (activeProjectId) {
          const res = await fetch(getApiUrl(`/api/v1/projects/${activeProjectId}`), {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const data = await res.json()
            const tasks = data.tasks || []
            setHasProjectTasks(tasks.length > 0)
            if (data.benchmark_data) {
              setBenchmark(data.benchmark_data)
            } else {
              setBenchmark(null)
            }

            if (tasks.length === 0) {
              setSelectedTarget("medium_superstructure")
            }
          }
        } else {
          setSelectedTarget("medium_superstructure")
        }
      } catch (err: any) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }

    checkProject()
  }, [activeProjectId, token])

  const handleRun = async () => {
    if (!token) return
    setIsRunning(true)
    setError(null)

    try {
      if (selectedTarget === "active_project" && activeProjectId) {
        // Run on active project network
        const res = await fetch(getApiUrl(`/api/v1/projects/${activeProjectId}/benchmark`), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || "Active project benchmark failed.")
        }

        const data = await res.json()
        setBenchmark(data)
      } else {
        // Run on preset
        const res = await fetch(getApiUrl("/api/v1/benchmark/run"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            benchmark_name:
              selectedTarget === "small_substructure"
                ? "Small: Substructure & Foundation (8 Tasks)"
                : "Medium: G+7 Superstructure & Services (14 Tasks)",
            cpsat_time_limit_seconds: 5.0,
            ga_population_size: 40,
            ga_generations: 50,
            random_seed: 42,
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.detail || "Benchmark execution failed.")
        }

        const data = await res.json()
        setBenchmark(data)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to execute solver benchmark.")
    } finally {
      setIsRunning(false)
    }
  }

  const copyMarkdown = () => {
    if (!benchmark?.markdown_table) return
    navigator.clipboard.writeText(benchmark.markdown_table)
    setCopiedMd(true)
    setTimeout(() => setCopiedMd(false), 2000)
  }

  const copyJson = () => {
    if (!benchmark) return
    navigator.clipboard.writeText(JSON.stringify(benchmark, null, 2))
    setCopiedJson(true)
    setTimeout(() => setCopiedJson(false), 2000)
  }

  // Permission check
  if (!hasPermission(["admin", "project_manager"])) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar projectName="OR-Tools CP-SAT vs Genetic Algorithm Benchmark" />
        <main className="p-6">
          <PermissionDenied
            title="Access Restricted"
            description="OR-Tools CP-SAT exact validation and RCPSP solver benchmarking is restricted to Project Managers and Administrators."
            requiredRoles={["admin", "project_manager"]}
          />
        </main>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar projectName="OR-Tools CP-SAT vs Genetic Algorithm Benchmark" />
        <div className="flex flex-col items-center justify-center p-16 font-mono text-xs text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
          Loading solver benchmarks and project networks...
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        projectName="OR-Tools CP-SAT vs Genetic Algorithm Benchmark"
        delayRiskDays={0}
        onRecalculate={handleRun}
        isOptimizing={isRunning}
      />

      <main className="p-4 md:p-6 space-y-6 max-w-7xl">
        {/* Benchmark Header & Preset Selection */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="border border-border bg-card p-4 rounded-[4px] shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                <h2 className="font-heading font-semibold text-sm text-foreground uppercase tracking-wider">
                  RCPSP Solver Benchmark Engine
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground font-mono">
                Exact Constraint Programming (Google OR-Tools CP-SAT) vs Fast Serial SGS Genetic Algorithm
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="text-xs font-mono bg-background border border-border p-2 text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              >
                {activeProjectId && hasProjectTasks && (
                  <option value="active_project">
                    Active Project: {activeProject?.name || "Current Tasks"}
                  </option>
                )}
                <option value="medium_superstructure">
                  Medium Benchmark: G+7 Superstructure (14 Tasks)
                </option>
                <option value="small_substructure">
                  Small Benchmark: Foundation & Substructure (8 Tasks)
                </option>
              </select>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleRun}
                disabled={isRunning}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground font-mono text-xs font-medium hover:bg-primary/90 transition-colors border border-primary rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Solving...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Run Solvers
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive text-destructive font-mono text-xs flex items-center gap-2 rounded-[4px]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {!benchmark ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="border border-dashed border-border bg-card/50 p-8 text-center space-y-3 rounded-[4px]"
          >
            <Cpu className="w-8 h-8 text-primary mx-auto opacity-75" />
            <h3 className="font-heading font-semibold text-sm text-foreground">
              Ready to Benchmark Schedulers
            </h3>
            <p className="text-xs font-mono text-muted-foreground max-w-md mx-auto">
              Execute Google OR-Tools CP-SAT (exact mathematical constraint solver) against the Genetic Algorithm metaheuristic to verify schedule optimality and solve times.
            </p>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleRun}
              disabled={isRunning}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-mono text-xs font-medium hover:bg-primary/90 transition-colors border border-primary rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Solving Network...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Run Benchmark Now
                </>
              )}
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="space-y-6"
          >
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* GA Card */}
              <div className="border border-border bg-card p-4 space-y-2 rounded-[4px] shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                    Heuristic Engine
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary rounded-[4px] font-semibold">
                    {benchmark.ga_metrics.status}
                  </span>
                </div>
                <div className="text-sm font-semibold font-heading text-foreground">
                  {benchmark.ga_metrics.solver_name}
                </div>
                <div className="pt-2 border-t border-border/60 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-foreground">
                    <AnimatedNumber
                      value={benchmark.ga_metrics.makespan_days}
                      formatter={(v) => `${v}`}
                    />{" "}
                    <span className="text-xs font-normal text-muted-foreground">days</span>
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    <AnimatedNumber
                      value={benchmark.ga_metrics.runtime_ms}
                      formatter={(v) => `${v.toFixed(1)} ms`}
                    />
                  </span>
                </div>
              </div>

              {/* CP-SAT Card */}
              <div className="border border-border bg-card p-4 space-y-2 rounded-[4px] shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                    Exact Solver
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-status-success/15 border border-status-success/30 text-status-success rounded-[4px] font-semibold">
                    {benchmark.cpsat_metrics.status}
                  </span>
                </div>
                <div className="text-sm font-semibold font-heading text-foreground">
                  {benchmark.cpsat_metrics.solver_name}
                </div>
                <div className="pt-2 border-t border-border/60 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-status-success">
                    <AnimatedNumber
                      value={benchmark.cpsat_metrics.makespan_days}
                      formatter={(v) => `${v}`}
                    />{" "}
                    <span className="text-xs font-normal text-muted-foreground">days</span>
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    <AnimatedNumber
                      value={benchmark.cpsat_metrics.runtime_ms}
                      formatter={(v) => `${v.toFixed(1)} ms`}
                    />
                  </span>
                </div>
              </div>

              {/* Optimality Gap Card */}
              <div className="border border-border bg-card p-4 space-y-2 rounded-[4px] shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                    Optimality Gap
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-secondary border border-border text-foreground rounded-[4px] font-medium">
                    {benchmark.task_count} Tasks
                  </span>
                </div>
                <div className="text-sm font-semibold font-heading text-foreground">
                  {benchmark.optimality_gap_percent === 0
                    ? "GA Reached Exact Optimal"
                    : `+${benchmark.optimality_gap_percent.toFixed(2)}% Over Optimal`}
                </div>
                <div className="pt-2 border-t border-border/60 flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-primary">
                    +<AnimatedNumber
                      value={benchmark.optimality_gap_percent}
                      formatter={(v) => `${v.toFixed(2)}%`}
                    />
                  </span>
                  <span className="text-xs font-mono text-status-success font-medium">
                    CP-SAT Validated
                  </span>
                </div>
              </div>
            </div>

            {/* View Selector & Export Buttons */}
            <div className="border border-border bg-card rounded-[4px] shadow-sm overflow-hidden">
              <div className="p-3 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab("table")}
                    className={`px-3 py-1 text-xs font-mono border rounded-[4px] transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
                      activeTab === "table"
                        ? "bg-primary text-primary-foreground border-primary font-semibold"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    Comparison Table
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab("json")}
                    className={`px-3 py-1 text-xs font-mono border rounded-[4px] transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
                      activeTab === "json"
                        ? "bg-primary text-primary-foreground border-primary font-semibold"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    Raw Solver JSON
                  </motion.button>
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={copyMarkdown}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-[4px] transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {copiedMd ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedMd ? "Copied Table" : "Copy Markdown"}</span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={copyJson}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-[4px] transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {copiedJson ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedJson ? "Copied JSON" : "Copy JSON"}</span>
                  </motion.button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {activeTab === "table" ? (
                  <motion.div
                    key="table"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="p-4 overflow-x-auto font-mono text-xs"
                  >
                    <div className="p-3 bg-muted/20 border border-border mb-4 text-[11px] text-muted-foreground rounded-[4px]">
                      Benchmark Target: <span className="text-foreground font-semibold">{benchmark.benchmark_name}</span> | Resource Capacities: {JSON.stringify(benchmark.resource_limits)}
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-xs text-[#E2E8F0] bg-[#12161F] p-4 border border-[#283243] rounded-[4px] shadow-inner">
                      {benchmark.markdown_table}
                    </pre>
                  </motion.div>
                ) : (
                  <motion.div
                    key="json"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="p-4 overflow-x-auto"
                  >
                    <pre className="text-xs font-mono text-[#E2E8F0] bg-[#12161F] p-4 border border-[#283243] rounded-[4px] overflow-x-auto shadow-inner">
                      {JSON.stringify(benchmark, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}
