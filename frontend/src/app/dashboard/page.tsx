"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts"
import { getApiUrl } from "@/lib/api"
import { TopBar } from "@/components/layout/TopBar"
import { EmptyState } from "@/components/ui/EmptyState"
import { PermissionDenied } from "@/components/ui/PermissionDenied"
import { useAuth } from "@/context/AuthContext"
import { formatINR } from "@/lib/utils"
import {
  PieChart as PieIcon,
  TrendingDown,
  TrendingUp,
  Coins,
  CheckCircle2,
  RefreshCw,
  Layers,
  Activity,
  Sliders,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Calendar,
} from "lucide-react"
import { motion } from "framer-motion"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"

interface CategoryMetric {
  category_name: string
  planned_budget: number
  actual_spent: number
  variance: number
  percentage_utilized: number
}

interface SCurvePoint {
  month: string
  planned_monthly: number
  actual_monthly: number
  planned_cumulative: number
  actual_cumulative: number
}

interface RecalibratedTask {
  task_id: string
  task_name: string
  baseline_crash_slope: number
  recalibrated_crash_slope: number
  material_factor_applied: number
  change_percent: number
}

interface DashboardData {
  project_name: string
  total_planned_budget: number
  total_actual_spent: number
  total_variance: number
  is_over_budget: boolean
  budget_utilization_percent: number
  categories: CategoryMetric[]
  s_curve_data: SCurvePoint[]
  recalibration_available: boolean
  recalibrated_tasks: RecalibratedTask[]
}

export default function DashboardPage() {
  const { user, token, activeProjectId, activeProject, hasPermission } = useAuth()

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isRecalibrating, setIsRecalibrating] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = async () => {
    if (!activeProjectId || !token) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(
        getApiUrl(`/api/v1/dashboard/budget-vs-actual?project_id=${activeProjectId}`),
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (!res.ok) {
        throw new Error("Failed to load dashboard metrics.")
      }
      const data = await res.json()
      setDashboardData(data)
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard analytics.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [activeProjectId, token])

  const handleRecalibrate = async () => {
    if (!activeProjectId || !token) return
    setIsRecalibrating(true)
    try {
      const res = await fetch(
        getApiUrl(`/api/v1/dashboard/recalibrate-crash-costs?project_id=${activeProjectId}`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (res.ok) {
        await fetchDashboardData()
      }
    } catch (err) {
      console.error("Recalibrate error:", err)
    } finally {
      setIsRecalibrating(false)
    }
  }

  // Permission check
  if (!hasPermission(["accountant", "owner", "admin", "project_manager"])) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar projectName="Budget vs Actual Dashboard" />
        <main className="p-6">
          <PermissionDenied
            title="Finance / Executive Access Required"
            description="Budget vs Actual financial analytics and delay risk exposure are restricted to Accountants, Owners, and Project Managers."
            requiredRoles={["accountant", "owner", "admin", "project_manager"]}
          />
        </main>
      </div>
    )
  }

  if (!activeProjectId) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar projectName="Budget vs Actual Dashboard" />
        <main className="p-6">
          <EmptyState
            title="No Active Project Selected"
            description="Select an active project from the sidebar to inspect Budget vs Actual spend series, S-curves, and MahaRERA risk exposure."
          />
        </main>
      </div>
    )
  }

  const isOwner = user?.role === "owner"
  const canRecalibrate = hasPermission(["accountant", "project_manager", "admin"])
  const delayDays = activeProject?.delay_days || 0
  const totalCost = activeProject?.total_project_cost || dashboardData?.total_planned_budget || 0
  const estimatedEscrow = totalCost * 0.70
  // MahaRERA annual rate: SBI MCLR 8.85% + 2% = 10.85%
  const annualInterestRate = 0.1085
  const dailyPenalty = (estimatedEscrow * annualInterestRate) / 365
  const totalPenaltyExposure = dailyPenalty * delayDays

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        projectName={activeProject?.name ? `Financials: ${activeProject.name}` : "Budget vs Actual Analytics"}
        delayRiskDays={delayDays}
      />

      <main className="p-4 md:p-6 space-y-6 max-w-7xl">
        {/* Top Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="border border-border bg-card p-4 rounded-[4px] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
        >
          <div>
            <h2 className="font-heading font-semibold text-base text-foreground flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-primary" />
              <span>
                {isOwner ? "Owner Executive Risk & Cost Control Dashboard" : "Budget vs Actual Cost Analytics"}
              </span>
            </h2>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              Live S-Curve Spend Model • Rate Recalibration from Material Delivery Slips
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canRecalibrate && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                disabled={isRecalibrating}
                onClick={handleRecalibrate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border text-foreground hover:bg-muted font-mono text-xs font-medium transition-colors rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRecalibrating ? "animate-spin" : ""}`} />
                <span>{isRecalibrating ? "RECALIBRATING..." : "RECALIBRATE FROM INVOICES"}</span>
              </motion.button>
            )}

            <Link
              href="/materials"
              className="px-3 py-1.5 bg-primary text-primary-foreground font-mono text-xs font-medium hover:bg-primary/90 transition-colors rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary"
            >
              View Material Logs
            </Link>
          </div>
        </motion.div>

        {error && (
          <div className="flex items-center gap-2 p-3 border border-destructive/50 bg-destructive/10 text-destructive text-xs font-mono rounded-[4px]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Owner / Executive Delay & Statutory Penalty Alert */}
        {(isOwner || delayDays > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="border border-destructive/40 bg-destructive/5 p-4 space-y-2 rounded-[4px] shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-destructive font-heading font-semibold text-xs tracking-wider uppercase">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Statutory MahaRERA Delay Exposure Alert</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-destructive/15 text-destructive border border-destructive/30 rounded-[4px] font-semibold">
                RULE 18 ENFORCEMENT
              </span>
            </div>
            <p className="text-xs font-sans text-muted-foreground leading-relaxed">
              Section 18 mandates compensation at SBI MCLR + 2% (currently 10.85% p.a.) on buyer funds for every day of delay past contractual handover.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
              <div className="p-3 bg-card border border-border rounded-[4px]">
                <div className="text-[10px] text-muted-foreground uppercase font-semibold">Project Delay</div>
                <div className="text-base font-bold text-destructive mt-1">+{delayDays} Days</div>
              </div>
              <div className="p-3 bg-card border border-border rounded-[4px]">
                <div className="text-[10px] text-muted-foreground uppercase font-semibold">Statutory Daily Penalty</div>
                <div className="text-base font-bold text-foreground mt-1">
                  <AnimatedNumber value={dailyPenalty} formatter={(v) => `${formatINR(v)} / day`} />
                </div>
              </div>
              <div className="p-3 bg-card border border-border rounded-[4px]">
                <div className="text-[10px] text-muted-foreground uppercase font-semibold">Cumulative Penalty Risk</div>
                <div className="text-base font-bold text-destructive mt-1">
                  <AnimatedNumber value={totalPenaltyExposure} formatter={(v) => formatINR(v)} />
                </div>
              </div>
            </div>
            <div className="pt-1 flex items-center justify-end">
              <Link
                href="/optimizer"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline font-semibold"
              >
                <span>Run Penalty vs Crash Cost Optimization</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        )}

        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Loading Financial Analytics & S-Curve...</span>
          </div>
        ) : !dashboardData || dashboardData.total_planned_budget === 0 ? (
          <EmptyState
            title="No Budget Data Available for this Project"
            description="Generate the Parametric WBS first to establish planned budgets across packages and track real spend from material logs."
            actionLabel="Generate Project WBS"
            actionHref="/wbs"
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="space-y-6"
          >
            {/* Primary Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 border border-border bg-card rounded-[4px] shadow-sm">
                <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  Planned Budget
                </div>
                <div className="text-xl font-bold font-mono text-foreground mt-1">
                  <AnimatedNumber
                    value={dashboardData.total_planned_budget}
                    formatter={(v) => formatINR(v)}
                  />
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  WBS Parametric Baseline
                </div>
              </div>

              <div className="p-4 border border-border bg-card rounded-[4px] shadow-sm">
                <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  Actual Material Spent
                </div>
                <div className="text-xl font-bold font-mono text-primary mt-1">
                  <AnimatedNumber
                    value={dashboardData.total_actual_spent}
                    formatter={(v) => formatINR(v)}
                  />
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  From site delivery receipts
                </div>
              </div>

              <div className="p-4 border border-border bg-card rounded-[4px] shadow-sm">
                <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  Budget Variance
                </div>
                <div
                  className={`text-xl font-bold font-mono mt-1 ${
                    dashboardData.total_variance >= 0 ? "text-status-success" : "text-destructive"
                  }`}
                >
                  <AnimatedNumber
                    value={dashboardData.total_variance}
                    formatter={(v) => formatINR(v)}
                  />
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {dashboardData.total_variance >= 0 ? "Under allocated budget" : "Cost overrun alert"}
                </div>
              </div>

              <div className="p-4 border border-border bg-card rounded-[4px] shadow-sm">
                <div className="text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                  Budget Utilization
                </div>
                <div className="text-xl font-bold font-mono text-foreground mt-1">
                  <AnimatedNumber
                    value={dashboardData.budget_utilization_percent}
                    formatter={(v) => `${v}%`}
                  />
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  Overall construction spend
                </div>
              </div>
            </div>

            {/* S-Curve Chart */}
            <div className="border border-border bg-card p-5 space-y-4 rounded-[4px] shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="font-heading font-semibold text-sm text-foreground">
                    12-Month S-Curve Progress (Planned vs Actual Cumulative Spend)
                  </h3>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Cumulative cashflow projection vs real site invoices
                  </p>
                </div>
              </div>

              <div className="h-64 sm:h-80 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.s_curve_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#8A94A6", fontSize: 10, fontFamily: "var(--font-mono)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(val) => `₹${(val / 10000000).toFixed(1)}Cr`}
                      tick={{ fill: "#8A94A6", fontSize: 10, fontFamily: "var(--font-mono)" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatINR(Number(val)), "Spend"]}
                      contentStyle={{
                        backgroundColor: "#1A2029",
                        border: "1px solid #283243",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontFamily: "var(--font-mono)",
                        color: "#F1F5F9",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                      }}
                      itemStyle={{ color: "#F1F5F9" }}
                      labelStyle={{ color: "#8A94A6", fontWeight: "bold", marginBottom: "4px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", fontFamily: "var(--font-mono)", paddingTop: "8px" }} />
                    <Line
                      type="monotone"
                      dataKey="planned_cumulative"
                      name="Planned Cumulative Budget"
                      stroke="#8A94A6"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual_cumulative"
                      name="Actual Cumulative Spend"
                      stroke="#E8590C"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: "#E8590C" }}
                      activeDot={{ r: 5, fill: "#E8590C", stroke: "#FFF", strokeWidth: 1.5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Package Breakdown Table */}
            <div className="border border-border bg-card rounded-[4px] shadow-sm overflow-hidden">
              <div className="p-3 bg-muted/30 border-b border-border flex items-center justify-between">
                <span className="font-heading font-semibold text-xs text-foreground">
                  Work Package Level Budget Allocation vs Actual Spent
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  6 MahaRERA Construction Packages
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-2 px-3">Work Package</th>
                      <th className="py-2 px-3">Planned Budget</th>
                      <th className="py-2 px-3">Actual Spent</th>
                      <th className="py-2 px-3">Variance</th>
                      <th className="py-2 px-3">Utilization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {dashboardData.categories.map((c, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-medium text-foreground">{c.category_name}</td>
                        <td className="py-2.5 px-3">{formatINR(c.planned_budget)}</td>
                        <td className="py-2.5 px-3 text-primary font-semibold">{formatINR(c.actual_spent)}</td>
                        <td className="py-2.5 px-3 font-medium">
                          <span className={c.variance >= 0 ? "text-status-success" : "text-destructive"}>
                            {formatINR(c.variance)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-muted h-2 border border-border">
                              <div
                                className="bg-primary h-full"
                                style={{ width: `${Math.min(100, c.percentage_utilized)}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold">{c.percentage_utilized}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recalibrated Critical Crash Slopes Section */}
            {dashboardData.recalibrated_tasks.length > 0 && (
              <div className="border border-border bg-card p-4 space-y-3 rounded-[4px] shadow-sm">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div>
                    <h3 className="font-heading font-semibold text-xs text-foreground flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-primary" />
                      <span>Recalibrated Critical Activity Crash Costs (Site Invoice Feedback)</span>
                    </h3>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Crash-cost slopes adjusted dynamically using actual site purchase invoices.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-2 px-3">Activity ID</th>
                        <th className="py-2 px-3">Task Title</th>
                        <th className="py-2 px-3">Baseline Slope (₹/day)</th>
                        <th className="py-2 px-3">Recalibrated Slope (₹/day)</th>
                        <th className="py-2 px-3">Material Factor</th>
                        <th className="py-2 px-3">Slope Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {dashboardData.recalibrated_tasks.map((task) => (
                        <tr key={task.task_id} className="hover:bg-muted/30">
                          <td className="py-2 px-3 font-semibold text-primary">{task.task_id}</td>
                          <td className="py-2 px-3 text-foreground font-sans">{task.task_name}</td>
                          <td className="py-2 px-3 text-muted-foreground">₹{task.baseline_crash_slope.toLocaleString()}</td>
                          <td className="py-2 px-3 font-semibold text-foreground">
                            ₹{task.recalibrated_crash_slope.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{task.material_factor_applied}x</td>
                          <td className="py-2 px-3">
                            <span
                              className={
                                task.change_percent > 0
                                    ? "text-status-warning font-semibold"
                                    : "text-status-success font-semibold"
                              }
                            >
                              {task.change_percent > 0 ? `+${task.change_percent}%` : `${task.change_percent}%`}
                            </span>
                          </td>
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
