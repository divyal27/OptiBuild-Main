"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { getApiUrl } from "@/lib/api"
import { TopBar } from "@/components/layout/TopBar"
import { EmptyState } from "@/components/ui/EmptyState"
import { PermissionDenied } from "@/components/ui/PermissionDenied"
import { useAuth } from "@/context/AuthContext"
import { formatINR } from "@/lib/utils"
import {
  FileSpreadsheet,
  Building2,
  Layers,
  Coins,
  Calendar,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { motion } from "framer-motion"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"

interface WbsItem {
  wbs_code: string
  title: string
  category: string
  budget_percentage: number
  estimated_cost: number
  duration_days: number
  predecessors: string[]
  resource_demands: Record<string, number>
}

interface WbsCategory {
  category_name: string
  total_percentage: number
  total_cost: number
  items: WbsItem[]
}

interface WbsData {
  project_name: string
  built_up_area_sqft: number
  base_rate_per_sqft: number
  total_estimated_cost: number
  categories: WbsCategory[]
  cpm_makespan_days: number
}

export default function WbsPage() {
  const { user, token, activeProjectId, activeProject, refreshProjects, hasPermission } = useAuth()

  const [builtUpArea, setBuiltUpArea] = useState<number>(75000)
  const [numberOfFloors, setNumberOfFloors] = useState<number>(14)
  const [numberOfBasements, setNumberOfBasements] = useState<number>(1)
  const [baseRate, setBaseRate] = useState<number>(2400)

  const [wbsData, setWbsData] = useState<WbsData | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch project details on activeProjectId change
  useEffect(() => {
    if (!activeProjectId || !token) {
      setIsLoading(false)
      return
    }

    const fetchProject = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(getApiUrl(`/api/v1/projects/${activeProjectId}`), {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.built_up_area_sqft) setBuiltUpArea(data.built_up_area_sqft)
          if (data.number_of_floors) setNumberOfFloors(data.number_of_floors)
          if (data.number_of_basements !== undefined) setNumberOfBasements(data.number_of_basements)
          if (data.base_rate_per_sqft) setBaseRate(data.base_rate_per_sqft)

          if (data.wbs_data) {
            setWbsData(data.wbs_data)
          } else {
            setWbsData(null)
          }
        } else {
          setError("Failed to load project details.")
        }
      } catch (err: any) {
        setError(err.message || "Failed to load project details.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProject()
  }, [activeProjectId, token])

  const handleGenerateWbs = async () => {
    if (!activeProjectId || !token) return
    setIsGenerating(true)
    setError(null)

    try {
      const res = await fetch(getApiUrl(`/api/v1/projects/${activeProjectId}/wbs`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          project_name: activeProject?.name || "Project",
          built_up_area_sqft: builtUpArea,
          number_of_floors: numberOfFloors,
          number_of_basements: numberOfBasements,
          base_rate_per_sqft: baseRate,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "WBS generation failed.")
      }

      const data = await res.json()
      setWbsData(data.wbs_data)
      await refreshProjects()
    } catch (err: any) {
      setError(err.message || "Failed to generate WBS.")
    } finally {
      setIsGenerating(false)
    }
  }

  // Permission check
  if (!hasPermission(["project_manager", "admin", "site_engineer", "architect", "accountant", "owner"])) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar projectName="Parametric WBS & Cost Estimation" />
        <main className="p-6">
          <PermissionDenied
            title="Access Restricted"
            description="Work Breakdown Structure estimation is restricted to project planning, engineering, and finance personnel."
            requiredRoles={["project_manager", "admin", "site_engineer", "architect", "accountant", "owner"]}
          />
        </main>
      </div>
    )
  }

  if (!activeProjectId) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar projectName="Parametric WBS & Cost Estimation" />
        <main className="p-6">
          <EmptyState
            title="No Active Project Selected"
            description="Please upload a MahaRERA PDF or select an existing project to generate the Work Breakdown Structure."
            actionLabel="Register MahaRERA Project"
            actionHref="/rera-review"
          />
        </main>
      </div>
    )
  }

  const canEdit = hasPermission(["project_manager", "admin"])

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        projectName={activeProject?.name ? `WBS: ${activeProject.name}` : "Parametric WBS & Cost Estimation"}
        delayRiskDays={activeProject?.delay_days || 0}
      />

      <main className="p-4 md:p-6 space-y-6 max-w-7xl">
        {/* Header Summary */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="border border-border bg-card p-4 rounded-[4px] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
        >
          <div>
            <h2 className="font-heading font-semibold text-base text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              <span>Parametric Work Breakdown Structure (WBS) & Budget Engine</span>
            </h2>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              Standard MahaRERA Rate Distribution Table • Pune/Mumbai Municipal Corporation Norms
            </p>
          </div>

          {wbsData && (
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-mono text-xs font-medium hover:bg-primary/90 transition-colors rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary active:scale-[0.98]"
              >
                <span>Proceed to Gantt Schedule</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </motion.div>

        {error && (
          <div className="flex items-center gap-2 p-3 border border-destructive/50 bg-destructive/10 text-destructive text-xs font-mono rounded-[4px]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Building Parameters Input Form */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="border border-border bg-card p-5 space-y-4 rounded-[4px] shadow-sm"
        >
          <div className="text-xs font-mono uppercase text-muted-foreground tracking-wider font-semibold border-b border-border pb-2 flex items-center justify-between">
            <span>Building Parameters & Cost Base</span>
            <span className="text-[10px] text-primary font-bold">{activeProject?.name}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-mono text-muted-foreground mb-1 font-semibold">
                Built-Up Area (sq.ft)
              </label>
              <input
                type="number"
                disabled={!canEdit || isGenerating}
                value={builtUpArea}
                onChange={(e) => setBuiltUpArea(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-background border border-border text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-60 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-muted-foreground mb-1 font-semibold">
                Floors (G + Floors)
              </label>
              <input
                type="number"
                disabled={!canEdit || isGenerating}
                value={numberOfFloors}
                onChange={(e) => setNumberOfFloors(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-background border border-border text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-60 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-muted-foreground mb-1 font-semibold">
                Basements Count
              </label>
              <input
                type="number"
                disabled={!canEdit || isGenerating}
                value={numberOfBasements}
                onChange={(e) => setNumberOfBasements(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-background border border-border text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-60 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-muted-foreground mb-1 font-semibold">
                Base Rate (₹ / sq.ft)
              </label>
              <input
                type="number"
                disabled={!canEdit || isGenerating}
                value={baseRate}
                onChange={(e) => setBaseRate(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-background border border-border text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-60 transition-colors"
              />
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end pt-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                disabled={isGenerating}
                onClick={handleGenerateWbs}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-mono text-xs font-semibold hover:bg-primary/90 transition-colors rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>CALCULATING WBS PACKAGES & DAG...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{wbsData ? "RE-GENERATE PARAMETRIC WBS" : "GENERATE PARAMETRIC WBS"}</span>
                  </>
                )}
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* WBS Output Display */}
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Loading Project WBS Data...</span>
          </div>
        ) : !wbsData ? (
          <EmptyState
            title="WBS Not Yet Generated for This Project"
            description="Use the building parameters form above to compute the 6 standard construction packages, itemized cost estimates, and DAG schedule activities."
            actionLabel={canEdit ? "Generate WBS Now" : undefined}
            onAction={canEdit ? handleGenerateWbs : undefined}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="space-y-6"
          >
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 border border-border bg-card rounded-[4px] shadow-sm">
                <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  Total Estimated Project Cost
                </div>
                <div className="text-xl font-bold font-mono text-foreground mt-1">
                  <AnimatedNumber
                    value={wbsData.total_estimated_cost}
                    formatter={(v) => formatINR(v)}
                  />
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  @ ₹{wbsData.base_rate_per_sqft} / sq.ft • {wbsData.built_up_area_sqft.toLocaleString()} sq.ft
                </div>
              </div>

              <div className="p-4 border border-border bg-card rounded-[4px] shadow-sm">
                <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  Unconstrained CPM Makespan
                </div>
                <div className="text-xl font-bold font-mono text-primary mt-1">
                  <AnimatedNumber
                    value={wbsData.cpm_makespan_days}
                    formatter={(v) => `${v} Days`}
                  />
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  Critical path sequence calculated
                </div>
              </div>

              <div className="p-4 border border-border bg-card rounded-[4px] shadow-sm">
                <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  WBS Breakdown Packages
                </div>
                <div className="text-xl font-bold font-mono text-foreground mt-1">
                  {wbsData.categories.length} Work Packages
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {wbsData.categories.reduce((acc, c) => acc + c.items.length, 0)} Total Activities
                </div>
              </div>
            </div>

            {/* Packages Table */}
            <div className="border border-border bg-card rounded-[4px] shadow-sm divide-y divide-border overflow-hidden">
              {wbsData.categories.map((cat, idx) => (
                <div key={idx} className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-semibold text-xs text-foreground uppercase tracking-wider">
                        {cat.category_name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-secondary border border-border text-muted-foreground rounded-[4px] font-medium">
                        {cat.total_percentage}% Allocation
                      </span>
                    </div>
                    <div className="font-mono font-semibold text-xs text-foreground">
                      {formatINR(cat.total_cost)}
                    </div>
                  </div>

                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                    <table className="w-full min-w-[580px] text-left text-xs font-mono border-collapse">
                      <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground border-y border-border">
                        <tr>
                          <th className="py-2 px-3 font-semibold">WBS Code</th>
                          <th className="py-2 px-3 font-semibold">Activity Description</th>
                          <th className="py-2 px-3 font-semibold">Duration</th>
                          <th className="py-2 px-3 font-semibold">Predecessors</th>
                          <th className="py-2 px-3 font-semibold">Share</th>
                          <th className="py-2 px-3 text-right font-semibold">Estimated Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {cat.items.map((item) => (
                          <tr key={item.wbs_code} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-primary">{item.wbs_code}</td>
                            <td className="py-2.5 px-3 text-foreground font-sans font-medium">{item.title}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">{item.duration_days}d</td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {item.predecessors.length > 0 ? item.predecessors.join(", ") : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">{item.budget_percentage}%</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                              {formatINR(item.estimated_cost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}
