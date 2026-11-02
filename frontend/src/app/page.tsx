"use client"

import React, { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { getApiUrl } from "@/lib/api"
import { TopBar } from "@/components/layout/TopBar"
import { GanttSchedule, ScheduleTask } from "@/components/schedule/GanttSchedule"
import { RecoverySidePanel } from "@/components/optimizer/RecoverySidePanel"
import { EmptyState } from "@/components/ui/EmptyState"
import { SiteWeatherWidget } from "@/components/weather/SiteWeatherWidget"
import { GuidedStepper } from "@/components/project/GuidedStepper"
import { DataConsentCard } from "@/components/project/DataConsentCard"
import { useAuth, ProjectSummary } from "@/context/AuthContext"
import { StaggeredGrid, StaggeredGridItem } from "@/components/ui/StaggeredGrid"
import { SharedTooltipAvatars, TeamMemberAvatar } from "@/components/ui/SharedTooltipAvatars"
import { Counter } from "@/components/ui/Counter"
import { Progress } from "@/components/ui/progress"
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
  Building,
  TrendingUp,
  Clock,
  Sparkles,
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
      setError(err.message || "Failed to load project.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProjectData()
  }, [activeProjectId, token])

  // Active project helper
  const effectiveActiveProject = useMemo(() => {
    if (activeProject) return activeProject
    if (activeProjectId && projects.length > 0) {
      return projects.find((p) => p.id === activeProjectId) || null
    }
    return projects[0] || null
  }, [activeProject, activeProjectId, projects])

  // Portfolio KPIs
  const portfolioKPIs = useMemo(() => {
    const totalProjects = projects.length
    const delayedProjects = projects.filter((p) => Number(p.delay_days || 0) > 0).length
    const totalCapital = projects.reduce((acc, p) => acc + (p.total_project_cost || 0), 0)
    const maxDelay = Math.max(...projects.map((p) => Number(p.delay_days || 0)), 0)
    return { totalProjects, delayedProjects, totalCapital, maxDelay }
  }, [projects])

  // Project progress percentage helper
  const getProjectProgress = (proj: ProjectSummary): number => {
    if (proj.status === "COMPLETED") return 100
    if (!proj.has_wbs) return 5
    if (!proj.has_schedule) return 35
    if (!proj.has_optimizer) return 65
    return 80
  }

  // Project team avatars helper
  const getProjectTeam = (proj: ProjectSummary): TeamMemberAvatar[] => {
    const count = (proj as any).members_count || 1
    const roles = ["PM", "Engineer", "Architect", "Store", "Accountant"]
    return Array.from({ length: Math.min(count, 5) }).map((_, i) => ({
      name: `Member ${i + 1}`,
      role: roles[i % roles.length],
    }))
  }

  // Schedule task duration update
  const handleTaskChange = (updatedTask: ScheduleTask) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    )
  }

  // Quick task progress update handler
  const handleUpdateTaskProgress = async (taskId: string, newPercent: number) => {
    if (!activeProjectId || !token) return
    const newStatus = newPercent === 100 ? "COMPLETED" : newPercent > 0 ? "IN_PROGRESS" : "NOT_STARTED"

    try {
      const res = await fetch(getApiUrl(`/api/v1/projects/${activeProjectId}/tasks/${taskId}/progress`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          progress_percent: newPercent,
          status: newStatus,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to update progress.")
      }

      setDbTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, progress_percent: newPercent, status: newStatus } : t))
      )
    } catch (err: any) {
      setError(err.message || "Failed to update task progress.")
    }
  }

  // Run Delay Recovery Optimizer & Save
  const handleRunOptimizer = async () => {
    if (!effectiveActiveProject || !token) return
    setIsOptimizing(true)
    setError(null)
    setSaveSuccessMsg(null)

    try {
      const res = await fetch(getApiUrl(`/api/v1/projects/${effectiveActiveProject.id}/optimizer`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          delay_days: effectiveActiveProject.delay_days || 14,
          target_recovery_days: effectiveActiveProject.delay_days || 14,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Failed to run Delay Optimizer.")
      }

      const result = await res.json()
      setOptimizerData(result.optimizer_data || result)
      setSaveSuccessMsg("Optimizer run saved! View trade-off recommendation below.")
      await refreshProjects()
    } catch (err: any) {
      setError(err.message || "Failed to run optimizer.")
    } finally {
      setIsOptimizing(false)
    }
  }

  const criticalTasksCount = tasks.filter((t) => t.is_critical).length
  const totalMakespan = Math.max(...tasks.map((t) => t.finish_day), 0)
  const unconstrainedCpmDays = Math.max(1, Math.round(totalMakespan * 0.85))
  const delayRiskDays = effectiveActiveProject?.delay_days || Math.max(0, totalMakespan - unconstrainedCpmDays)

  const canEditProgress = hasPermission(["site_engineer", "project_manager", "admin"])
  const canRunSchedule = hasPermission(["project_manager", "admin"])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        projectName={effectiveActiveProject?.name ? `Overview: ${effectiveActiveProject.name}` : "Projects Overview"}
        delayRiskDays={delayRiskDays}
        onRecalculate={canRunSchedule && tasks.length > 0 ? handleRunOptimizer : undefined}
        isOptimizing={isOptimizing}
      />

      <main className="p-4 md:p-6 space-y-6">
        {/* Portfolio KPI Ribbon */}
        <section aria-label="Portfolio Metrics" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-border bg-card p-3 rounded-[4px] shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-mono uppercase tracking-wider">
                Total Projects
              </span>
              <FolderKanban className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold text-foreground">
                <Counter value={portfolioKPIs.totalProjects} />
              </span>
              <span className="text-xs font-mono text-muted-foreground">active sites</span>
            </div>
            <div className="mt-1 text-[10px] font-mono text-muted-foreground">
              RERA Compliant Sites
            </div>
          </div>

          <div className="border border-border bg-card p-3 rounded-[4px] shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-mono uppercase tracking-wider">
                Delayed Projects
              </span>
              <AlertTriangle className="w-3.5 h-3.5 text-status-warning" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold text-status-warning">
                <Counter value={portfolioKPIs.delayedProjects} />
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                of {portfolioKPIs.totalProjects} sites
              </span>
            </div>
            <div className="mt-1 text-[10px] font-mono text-muted-foreground">
              Max Exposure: +{portfolioKPIs.maxDelay} days
            </div>
          </div>

          <div className="border border-border bg-card p-3 rounded-[4px] shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-mono uppercase tracking-wider">
                Active Capital
              </span>
              <Building className="w-3.5 h-3.5 text-foreground" />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-mono font-bold text-foreground">
                <Counter value={portfolioKPIs.totalCapital} isCurrency compact />
              </span>
            </div>
            <div className="mt-1 text-[10px] font-mono text-muted-foreground">
              Escrow & Construction Pool
            </div>
          </div>

          <div className="border border-border bg-card p-3 rounded-[4px] shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10px] font-mono uppercase tracking-wider">
                Selected Project
              </span>
              <HardHat className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="mt-1 truncate font-heading font-bold text-sm text-foreground">
              {effectiveActiveProject?.name || "None Selected"}
            </div>
            <div className="mt-1 text-[10px] font-mono text-muted-foreground truncate">
              ID: {effectiveActiveProject?.id || "N/A"}
            </div>
          </div>
        </section>

        {/* Projects Overview Deck with Staggered Grid */}
        <section aria-label="Projects Deck" className="space-y-3">
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
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground font-mono text-xs hover:bg-primary/90 transition-colors border border-primary rounded-[2px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </Link>
            )}
          </div>

          <StaggeredGrid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((proj) => {
              const isSelected = proj.id === activeProjectId
              const teamMembers = getProjectTeam(proj)
              const completionPercent = getProjectProgress(proj)
              const isDelayed = Number(proj.delay_days || 0) > 0

              return (
                <StaggeredGridItem key={proj.id}>
                  <div
                    className={`border p-4 bg-card transition-all flex flex-col justify-between rounded-[4px] h-full ${
                      isSelected
                        ? "border-primary shadow-sm ring-1 ring-primary/40"
                        : "border-border hover:border-border/80 hover:shadow-xs"
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-heading font-bold text-sm text-foreground truncate">
                            {proj.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-muted-foreground">
                            <span>{proj.rera_registration_no || "RERA Pending"}</span>
                            <span>•</span>
                            <span>{proj.status}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="shrink-0 px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/30 text-[9px] font-mono uppercase tracking-wider rounded-[2px]">
                            ACTIVE
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground">Milestone Progress</span>
                          <span className="text-foreground font-semibold">{completionPercent}%</span>
                        </div>
                        <Progress value={completionPercent} className="h-1.5" />
                      </div>

                      {/* Metrics Strip */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono py-2 border-y border-border/60">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">Budget</div>
                          <div className="font-bold text-foreground">
                            <Counter value={proj.total_project_cost || 0} isCurrency compact />
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase">Delay Status</div>
                          <div className={isDelayed ? "font-bold text-status-warning" : "text-status-success font-semibold"}>
                            {isDelayed ? `+${proj.delay_days}d behind` : "On Schedule"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="mt-4 pt-2 flex items-center justify-between">
                      <SharedTooltipAvatars members={teamMembers} maxDisplay={4} size="sm" />
                      <div className="flex items-center gap-1.5">
                        {!isSelected && (
                          <button
                            type="button"
                            onClick={() => setActiveProjectId(proj.id)}
                            className="px-2 py-1 text-[11px] font-mono border border-border bg-background hover:bg-muted text-foreground transition-colors rounded-[2px]"
                          >
                            Select
                          </button>
                        )}
                        <Link
                          href="/wbs"
                          onClick={() => setActiveProjectId(proj.id)}
                          className="px-2 py-1 text-[11px] font-mono bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1 rounded-[2px]"
                        >
                          <span>Gantt</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </StaggeredGridItem>
              )
            })}
          </StaggeredGrid>
        </section>

        {error && (
          <div className="flex items-center gap-2 p-3 border border-destructive/50 bg-destructive/10 text-destructive text-xs font-mono rounded-[4px]">
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

        {/* DPDP Act 2023 Consent & Algorithmic Telemetry Gate */}
        {effectiveActiveProject && (
          <DataConsentCard
            projectId={effectiveActiveProject.id}
            projectName={effectiveActiveProject.name}
          />
        )}

        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2 border border-border bg-card rounded-[4px]">
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
            {/* Critical Path & Hero Timeline Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <h2 className="font-heading font-semibold text-sm uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <span>HERO SCHEDULE & RESOURCE TIMELINE ({effectiveActiveProject?.name})</span>
                  </h2>
                  <p className="text-xs text-muted-foreground font-sans mt-0.5">
                    CPM critical path highlighted in safety orange. Resource constrained under 32 laborers and 1 tower crane limit.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {canRunSchedule && (
                    <button
                      type="button"
                      disabled={isOptimizing}
                      onClick={handleRunOptimizer}
                      className="px-3 py-1 bg-primary text-primary-foreground font-mono text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5 border border-primary rounded-[2px]"
                    >
                      {isOptimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sliders className="w-3.5 h-3.5" />}
                      <span>{isOptimizing ? "Running..." : "Evaluate Recovery"}</span>
                    </button>
                  )}
                  <Link
                    href="/wbs"
                    className="px-3 py-1 border border-border bg-card hover:bg-muted text-foreground font-mono text-xs transition-colors rounded-[2px]"
                  >
                    Edit WBS
                  </Link>
                </div>
              </div>

              {/* Weather Risk Widget */}
              <SiteWeatherWidget
                cityName="Pune Construction Hub"
                latitude={18.5204}
                longitude={73.8567}
                activeTasks={tasks.slice(0, 5).map((t) => ({
                  id: t.id,
                  name: t.name,
                  duration: t.duration,
                  is_critical: t.is_critical,
                }))}
              />

              {/* Gantt Chart Workstation */}
              <div className="border border-border bg-card p-4 rounded-[4px] shadow-2xs">
                <GanttSchedule
                  tasks={tasks}
                  onTaskChange={canRunSchedule ? handleTaskChange : undefined}
                />
              </div>
            </div>

            {/* Delay Recovery Optimizer Decision Section */}
            {optimizerData && (
              <section aria-label="Delay Recovery Decision" className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading font-semibold text-xs uppercase tracking-wider text-foreground flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-status-warning" />
                      <span>MAHARERA STATUTORY DELAY RECOVERY DECISION</span>
                    </h2>
                    <p className="text-xs text-muted-foreground font-sans mt-0.5">
                      Comparing Section 18 statutory buyer interest liability vs greedy critical path schedule compression.
                    </p>
                  </div>
                  <Link
                    href="/optimizer"
                    className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                  >
                    <span>Full Recovery Panel</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <RecoverySidePanel
                  optimizerResult={optimizerData}
                  onApplyStrategy={(recommendation) => {
                    setSaveSuccessMsg(`Applied recovery strategy: ${recommendation}`)
                  }}
                />
              </section>
            )}

            {/* Granular Task Execution Roster */}
            <div className="border border-border bg-card p-4 rounded-[4px] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-semibold text-xs uppercase tracking-wider text-foreground">
                    PROJECT TASKS & SITE PROGRESS ROSTER
                  </h3>
                  <p className="text-xs text-muted-foreground font-sans">
                    Live task execution statuses and critical float indicators.
                  </p>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {dbTasks.length} tasks registered
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground bg-muted/40">
                      <th className="py-2 px-3">Task ID</th>
                      <th className="py-2 px-3">Activity Title</th>
                      <th className="py-2 px-3">Duration</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Completion (%)</th>
                      {canEditProgress && <th className="py-2 px-3 text-right">Quick Update</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {dbTasks.map((t) => {
                      const progress = t.progress_percent || 0
                      return (
                        <tr key={t.id} className="hover:bg-muted/30">
                          <td className="py-2 px-3 font-semibold text-primary">{t.id}</td>
                          <td className="py-2 px-3 text-foreground font-sans">
                            {t.name}
                            {t.is_critical && (
                              <span className="ml-2 text-[9px] font-mono px-1 py-0.2 bg-destructive/15 text-destructive border border-destructive/30 rounded-[2px]">
                                CRITICAL
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{t.duration}d</td>
                          <td className="py-2 px-3">
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 border rounded-[2px] ${
                                progress === 100
                                  ? "bg-status-success/15 text-status-success border-status-success/30"
                                  : progress > 0
                                  ? "bg-status-warning/15 text-status-warning border-status-warning/30"
                                  : "bg-muted text-muted-foreground border-border"
                              }`}
                            >
                              {progress === 100 ? "COMPLETED" : progress > 0 ? "IN PROGRESS" : "NOT STARTED"}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-muted h-2 border border-border rounded-[2px]">
                                <div
                                  className="bg-primary h-full transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold">{progress}%</span>
                            </div>
                          </td>
                          {canEditProgress && (
                            <td className="py-2 px-3 text-right space-x-1">
                              {[25, 50, 75, 100].map((pct) => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => handleUpdateTaskProgress(t.id, pct)}
                                  className={`px-1.5 py-0.5 text-[10px] border transition-colors rounded-[2px] ${
                                    progress === pct
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-card hover:bg-muted text-muted-foreground border-border"
                                  }`}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
