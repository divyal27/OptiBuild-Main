"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { getApiUrl } from "@/lib/api"
import { TopBar } from "@/components/layout/TopBar"
import { GanttSchedule, ScheduleTask } from "@/components/schedule/GanttSchedule"
import { RecoverySidePanel } from "@/components/optimizer/RecoverySidePanel"
import { EmptyState } from "@/components/ui/EmptyState"
import { SiteWeatherWidget } from "@/components/weather/SiteWeatherWidget"
import { GuidedStepper } from "@/components/project/GuidedStepper"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"
import { useAuth } from "@/context/AuthContext"
import {
  Calendar,
  Layers,
  AlertTriangle,
  Users,
  CheckCircle2,
  HardHat,
  Activity,
  ArrowRight,
  Loader2,
  Sliders,
  Save,
  Check,
  RefreshCw,
  FolderKanban,
  Plus,
} from "lucide-react"

export default function HomePage() {
  const {
    user,
    token,
    projects,
    activeProjectId,
    activeProject,
    setActiveProjectId,
    refreshProjects,
    hasPermission,
  } = useAuth()

  const [tasks, setTasks] = useState<ScheduleTask[]>([])
  const [dbTasks, setDbTasks] = useState<any[]>([])
  const [optimizerData, setOptimizerData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null)

  // Fetch project tasks and schedule
  const fetchProjectData = async () => {
    if (!activeProjectId || !token) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(getApiUrl(`/api/v1/projects/${activeProjectId}`), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error("Failed to load project schedule data.")
      }
      const data = await res.json()
      setDbTasks(data.tasks || [])
      if (data.optimizer_data) {
        setOptimizerData(data.optimizer_data)
      }

      // If project has saved schedule_data, use the GA schedule
      if (data.schedule_data && data.schedule_data.ga && data.schedule_data.ga.schedule) {
        setTasks(data.schedule_data.ga.schedule)
      } else if (data.tasks && data.tasks.length > 0) {
        // Build initial sequential timeline from tasks
        let currentDay = 0
        const initialTasks: ScheduleTask[] = data.tasks.map((t: any) => {
          const start = currentDay
          const finish = start + (t.duration || 1)
          currentDay = finish
          return {
            id: t.id,
            name: t.name,
            duration: t.duration,
            start_day: start,
            finish_day: finish,
            is_critical: t.is_critical || false,
            resource_demands: t.resource_demands || { labor: 10 },
            predecessors: t.predecessors || [],
          }
        })
        setTasks(initialTasks)
      } else {
        setTasks([])
      }
    } catch (err: any) {
      setError(err.message || "Failed to load project tasks.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProjectData()
  }, [activeProjectId, token])

  const handleRunOptimizer = async () => {
    if (!activeProjectId || !token) return
    setIsOptimizing(true)
    setError(null)
    try {
      const res = await fetch(getApiUrl(`/api/v1/projects/${activeProjectId}/schedule`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resource_limits: { labor: 32, crane: 1 },
          ga_population_size: 40,
          ga_generations: 80,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Optimization failed.")
      }

      const data = await res.json()
      if (data.ga && data.ga.schedule) {
        setTasks(data.ga.schedule)
      }
      await fetchProjectData()
    } catch (err: any) {
      setError(err.message || "Schedule optimization failed.")
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleUpdateTaskProgress = async (taskId: string, newProgress: number) => {
    if (!activeProjectId || !token) return
    try {
      const res = await fetch(
        getApiUrl(`/api/v1/projects/${activeProjectId}/tasks/${taskId}/progress`),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            progress_percent: newProgress,
            status: newProgress === 100 ? "COMPLETED" : newProgress > 0 ? "IN_PROGRESS" : "NOT_STARTED",
          }),
        }
      )

      if (res.ok) {
        setDbTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  progress_percent: newProgress,
                  status: newProgress === 100 ? "COMPLETED" : newProgress > 0 ? "IN_PROGRESS" : "NOT_STARTED",
                }
              : t
          )
        )
        setSaveSuccessMsg(`Progress updated for activity ${taskId}`)
        setTimeout(() => setSaveSuccessMsg(null), 3000)
      }
    } catch (err) {
      console.error("Failed to update progress:", err)
    }
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar projectName="Projects Overview" />
        <main className="p-6">
          <EmptyState
            title="Upload a MahaRERA PDF to create your first project"
            description="Upload an official MahaRERA project certificate to automatically extract project timeline, built-up area, and statutory handover commitments."
            actionLabel="Upload MahaRERA PDF"
            actionHref="/rera-review"
          />
        </main>
      </div>
    )
  }

  const effectiveActiveProject =
    activeProject || projects.find((p) => p.id === activeProjectId) || projects[0]

  const criticalTasksCount = tasks.filter((t) => t.is_critical).length
  const totalMakespan = Math.max(...tasks.map((t) => t.finish_day), 0)
  const unconstrainedCpmDays = Math.max(1, Math.round(totalMakespan * 0.85))
  const delayRiskDays = effectiveActiveProject?.delay_days || Math.max(0, totalMakespan - unconstrainedCpmDays)

  const canEditProgress = hasPermission(["site_engineer", "project_manager", "admin"])
  const canRunSchedule = hasPermission(["project_manager", "admin"])

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        projectName={effectiveActiveProject?.name ? `Overview: ${effectiveActiveProject.name}` : "Projects Overview"}
        delayRiskDays={delayRiskDays}
        onRecalculate={canRunSchedule && tasks.length > 0 ? handleRunOptimizer : undefined}
        isOptimizing={isOptimizing}
      />

      <main className="p-4 md:p-6 space-y-6">
        {/* Projects Overview Deck */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-primary" />
              <h2 className="font-heading font-semibold text-xs uppercase tracking-wider text-foreground">
                PROJECTS OVERVIEW ({projects.length})
              </h2>
            </div>
            {hasPermission(["project_manager", "admin"]) && (
              <Link
                href="/rera-review"
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground font-mono text-xs hover:bg-primary/90 transition-colors border border-primary rounded-[4px] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => {
              const isSelected = proj.id === activeProjectId
              return (
                <div
                  key={proj.id}
                  className={`border p-4 bg-card transition-all flex flex-col justify-between rounded-[4px] ${
                    isSelected
                      ? "border-primary shadow-sm ring-1 ring-primary/40"
                      : "border-border hover:border-border/80"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-heading font-bold text-sm text-foreground line-clamp-1">
                          {proj.name}
                        </h3>
                        <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                          RERA: {proj.rera_registration_no || "Registration Pending"}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="shrink-0 px-2 py-0.5 bg-primary/10 text-primary border border-primary/30 text-[10px] font-mono font-bold uppercase rounded-[2px]">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="bg-muted/40 p-2 border border-border/50 rounded-[2px]">
                        <span className="text-muted-foreground block text-[10px]">Target Date:</span>
                        <span className="font-semibold text-foreground">
                          {proj.proposed_completion_date || "Not Set"}
                        </span>
                      </div>
                      <div className="bg-muted/40 p-2 border border-border/50 rounded-[2px]">
                        <span className="text-muted-foreground block text-[10px]">Delay Exposure:</span>
                        <span
                          className={`font-semibold ${
                            Number(proj.delay_days || 0) > 0 ? "text-status-warning" : "text-status-success"
                          }`}
                        >
                          +{proj.delay_days || 0} days
                        </span>
                      </div>
                    </div>

                    {/* Status Badges for WBS / Schedule / Optimizer */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 border rounded-[2px] ${
                          proj.has_wbs
                            ? "bg-status-success/15 text-status-success border-status-success/30 font-medium"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        WBS: {proj.has_wbs ? "Done" : "Pending"}
                      </span>

                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 border rounded-[2px] ${
                          proj.has_schedule
                            ? "bg-status-success/15 text-status-success border-status-success/30 font-medium"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        Schedule: {proj.has_schedule ? "Done" : "Pending"}
                      </span>

                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 border rounded-[2px] ${
                          proj.has_optimizer
                            ? "bg-status-success/15 text-status-success border-status-success/30 font-medium"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        Optimizer: {proj.has_optimizer ? "Done" : "Pending"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-primary font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Active Project
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveProjectId(proj.id)}
                        className="px-3 py-1 bg-secondary text-foreground text-xs font-mono font-medium border border-border hover:bg-muted transition-colors rounded-[2px] cursor-pointer"
                      >
                        Make Active
                      </button>
                    )}

                    <Link
                      href="/wbs"
                      onClick={() => {
                        if (!isSelected) setActiveProjectId(proj.id)
                      }}
                      className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <span>Work Breakdown</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 border border-destructive/50 bg-destructive/10 text-destructive text-xs font-mono rounded-[4px]"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saveSuccessMsg && (
          <div className="flex items-center gap-2 p-3 border border-status-success/50 bg-status-success/10 text-status-success text-xs font-mono rounded-[4px]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Guided Stepper if active project setup is in progress */}
        {effectiveActiveProject && (!effectiveActiveProject.has_wbs || !effectiveActiveProject.has_schedule || !effectiveActiveProject.has_optimizer) && (
          <GuidedStepper
            projectId={effectiveActiveProject.id}
            projectName={effectiveActiveProject.name}
            hasWbs={effectiveActiveProject.has_wbs}
            hasSchedule={effectiveActiveProject.has_schedule}
            hasOptimizer={effectiveActiveProject.has_optimizer}
            memberCount={(effectiveActiveProject as any).members_count || 0}
            currentStep={!effectiveActiveProject.has_wbs ? 3 : 4}
          />
        )}

        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Loading Project Schedule & Critical Path...</span>
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            title="Schedule Not Yet Generated for Active Project"
            description="This project currently has no WBS activities or scheduled timeline. Generate the WBS from building parameters to populate activities."
            actionLabel={canRunSchedule ? "Generate WBS & Cost Estimate" : undefined}
            actionHref="/wbs"
          />
        ) : (
          <>
            {/* Site Meteorology & Rain Delay Guard Widget */}
            <SiteWeatherWidget tasks={tasks} projectCity="Pune" />

            {/* Metric Ribbons */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <div className="border border-border bg-card p-3 rounded-[4px]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-mono uppercase tracking-wider">
                    Makespan (Days)
                  </span>
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <AnimatedNumber
                    value={totalMakespan}
                    className="text-2xl font-mono font-bold text-foreground"
                    suffix=" days"
                  />
                </div>
                <div className="mt-1 text-[10px] font-mono text-muted-foreground truncate">
                  Target Handover: {activeProject?.proposed_completion_date || "Active"}
                </div>
              </div>

              <div className="border border-border bg-card p-3 rounded-[4px]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-mono uppercase tracking-wider">
                    Delay Risk
                  </span>
                  <AlertTriangle className="w-3.5 h-3.5 text-status-warning" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <AnimatedNumber
                    value={delayRiskDays}
                    className="text-2xl font-mono font-bold text-status-warning"
                    prefix="+"
                    suffix=" days"
                  />
                </div>
                <div className="mt-1 text-[10px] font-mono text-muted-foreground truncate">
                  MahaRERA Exposure: {activeProject?.delay_days ? "Contractual Risk" : "Stable"}
                </div>
              </div>

              <div className="border border-border bg-card p-3 rounded-[4px]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-mono uppercase tracking-wider">
                    Critical Path
                  </span>
                  <Activity className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <AnimatedNumber
                    value={criticalTasksCount}
                    className="text-2xl font-mono font-bold text-primary"
                  />
                  <span className="text-xs font-mono text-muted-foreground">
                    of {tasks.length} tasks
                  </span>
                </div>
                <div className="mt-1 text-[10px] font-mono text-muted-foreground">
                  Zero float activities
                </div>
              </div>

              <div className="border border-border bg-card p-3 rounded-[4px]">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-[10px] font-mono uppercase tracking-wider">
                    Resource Constraints
                  </span>
                  <Users className="w-3.5 h-3.5 text-foreground" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-mono font-bold text-foreground">32</span>
                  <span className="text-xs font-mono text-muted-foreground">labor / 1 crane</span>
                </div>
                <div className="mt-1 text-[10px] font-mono text-muted-foreground truncate">
                  RCPSP Genetic Algorithm Mode
                </div>
              </div>
            </motion.div>

            {/* Gantt Chart & Recovery Side Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: 0.05 }}
                className="lg:col-span-3 border border-border bg-card p-4 space-y-4 rounded-[4px]"
              >
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h2 className="font-heading font-semibold text-sm text-foreground">
                      Construction Activity Gantt Timeline
                    </h2>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Critical path activities marked in safety orange • Dynamic serial schedule generation
                    </p>
                  </div>
                  {canRunSchedule && (
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      disabled={isOptimizing}
                      onClick={handleRunOptimizer}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-mono text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 rounded-[4px] cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isOptimizing ? "animate-spin" : ""}`} />
                      <span>{isOptimizing ? "SOLVING GA..." : "RUN RCPSP GA SOLVER"}</span>
                    </motion.button>
                  )}
                </div>

                <GanttSchedule tasks={tasks} />
              </motion.div>

              {/* Side Panel */}
              <div className="lg:col-span-1">
                <RecoverySidePanel
                  delayDays={optimizerData?.delay_days ?? activeProject?.delay_days ?? 14}
                  penaltyCost={optimizerData?.total_rera_penalty ?? 485000}
                  crashCost={optimizerData?.total_crash_cost ?? 210000}
                  crashedDaysRecovered={optimizerData?.days_recovered ?? 14}
                />
              </div>
            </div>

            {/* Site Engineer Progress Tracking Table */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.1 }}
              className="border border-border bg-card p-4 space-y-3 rounded-[4px]"
            >
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <h3 className="font-heading font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-primary" />
                    <span>Site Activity Progress Tracking & Verification</span>
                  </h3>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Site Engineers can update actual completion percentages directly from site inspections.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground border-y border-border">
                    <tr>
                      <th className="py-2 px-3">Activity ID</th>
                      <th className="py-2 px-3">Task Name</th>
                      <th className="py-2 px-3">Duration</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Completion (%)</th>
                      {canEditProgress && <th className="py-2 px-3 text-right">Quick Update</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {dbTasks.map((t, idx) => {
                      const progress = t.progress_percent || 0
                      return (
                        <motion.tr
                          key={t.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.18, delay: idx * 0.02 }}
                          className="hover:bg-muted/30"
                        >
                          <td className="py-2 px-3 font-semibold text-primary">{t.id}</td>
                          <td className="py-2 px-3 text-foreground font-sans">
                            {t.name}
                            {t.is_critical && (
                              <span className="ml-2 text-[9px] font-mono px-1 py-0.2 bg-destructive/15 text-destructive border border-destructive/30 rounded-[2px]">
                                CRITICAL
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground font-mono">{t.duration}d</td>
                          <td className="py-2 px-3">
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 border rounded-[2px] ${
                                progress === 100
                                  ? "bg-status-success/15 text-status-success border-status-success/30 font-medium"
                                  : progress > 0
                                  ? "bg-status-warning/15 text-status-warning border-status-warning/30 font-medium"
                                  : "bg-muted text-muted-foreground border-border"
                              }`}
                            >
                              {progress === 100 ? "COMPLETED" : progress > 0 ? "IN PROGRESS" : "NOT STARTED"}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-muted h-2 border border-border rounded-[1px] overflow-hidden">
                                <div
                                  className="bg-primary h-full transition-all duration-200"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold font-mono">{progress}%</span>
                            </div>
                          </td>
                          {canEditProgress && (
                            <td className="py-2 px-3 text-right space-x-1">
                              {[25, 50, 75, 100].map((pct) => (
                                <motion.button
                                  key={pct}
                                  type="button"
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleUpdateTaskProgress(t.id, pct)}
                                  className={`px-1.5 py-0.5 text-[10px] font-mono border rounded-[2px] transition-colors cursor-pointer ${
                                    progress === pct
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-card hover:bg-muted text-muted-foreground border-border"
                                  }`}
                                >
                                  {pct}%
                                </motion.button>
                              ))}
                            </td>
                          )}
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </>
        )}
      </main>
    </div>
  )
}
