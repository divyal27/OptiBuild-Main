"use client"

import React from "react"
import { CheckCircle2, AlertOctagon, TrendingUp, ShieldCheck } from "lucide-react"
import { formatINR } from "@/lib/utils"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"

interface RecoveryComparisonProps {
  delayDays?: number
  penaltyCost?: number
  crashCost?: number
  crashedDaysRecovered?: number
  interestRateAnnual?: number
}

export function RecoverySidePanel({
  delayDays = 14,
  penaltyCost = 485000,
  crashCost = 210000,
  crashedDaysRecovered = 14,
  interestRateAnnual = 10.85,
}: RecoveryComparisonProps) {
  const isCrashCheaper = crashCost < penaltyCost
  const netSavings = Math.abs(penaltyCost - crashCost)

  return (
    <div className="border border-border bg-card p-4 rounded-[4px] flex flex-col justify-between space-y-4 shadow-sm">
      <div>
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <div>
            <h2 className="font-heading font-semibold text-sm text-foreground">
              DELAY RECOVERY DECISION
            </h2>
            <div className="text-[11px] font-mono text-muted-foreground">
              MahaRERA Sec 18 vs Fast-Track Crashing
            </div>
          </div>
          <span className="font-mono text-xs px-2 py-0.5 bg-destructive/10 text-destructive border border-destructive/20 font-medium rounded-[4px]">
            +{delayDays}d Risk
          </span>
        </div>

        {/* Comparison Boxes */}
        <div className="mt-4 space-y-3">
          {/* Option A: Accept Penalty */}
          <div
            className={`p-3 border rounded-[4px] transition-colors ${
              !isCrashCheaper
                ? "border-status-success bg-status-success/5 ring-1 ring-status-success/30"
                : "border-border bg-muted/20 opacity-85"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-medium">
                  OPTION A • ACCEPT RERA PENALTY
                </span>
                <span className="text-lg font-mono font-bold text-foreground">
                  <AnimatedNumber value={penaltyCost} formatter={(v) => formatINR(v)} />
                </span>
              </div>
              {!isCrashCheaper ? (
                <span className="flex items-center gap-1 text-[10px] font-mono text-status-success font-semibold px-1.5 py-0.5 bg-status-success/15 border border-status-success/30 rounded-[4px]">
                  <CheckCircle2 className="w-3 h-3" /> CHEAPER
                </span>
              ) : (
                <span className="text-[10px] font-mono text-muted-foreground">
                  Higher Cost
                </span>
              )}
            </div>
            <div className="mt-2 text-[11px] font-mono text-muted-foreground leading-relaxed border-t border-border/50 pt-2 space-y-1">
              <div>• Delay: <span className="text-foreground">{delayDays} calendar days</span></div>
              <div>• Benchmark Rate: <span className="text-foreground">SBI MCLR + 2% ({interestRateAnnual}%)</span></div>
              <div>• Direct compensation liability to allottees</div>
            </div>
          </div>

          {/* Option B: Crash Critical Tasks */}
          <div
            className={`p-3 border rounded-[4px] transition-colors ${
              isCrashCheaper
                ? "border-status-success bg-status-success/5 ring-1 ring-status-success/30"
                : "border-border bg-muted/20 opacity-85"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block font-medium">
                  OPTION B • CRASH SCHEDULE (RECOMMENDED)
                </span>
                <span className="text-lg font-mono font-bold text-primary">
                  <AnimatedNumber value={crashCost} formatter={(v) => formatINR(v)} />
                </span>
              </div>
              {isCrashCheaper ? (
                <span className="flex items-center gap-1 text-[10px] font-mono text-status-success font-semibold px-1.5 py-0.5 bg-status-success/15 border border-status-success/30 rounded-[4px]">
                  <CheckCircle2 className="w-3 h-3" /> CHEAPER
                </span>
              ) : (
                <span className="text-[10px] font-mono text-muted-foreground">
                  Higher Cost
                </span>
              )}
            </div>
            <div className="mt-2 text-[11px] font-mono text-muted-foreground leading-relaxed border-t border-border/50 pt-2 space-y-1">
              <div>• Time Saved: <span className="text-foreground">-{crashedDaysRecovered} days</span> (Restores On-Time)</div>
              <div>• Crashing actions: <span className="text-foreground">Overtime shifts + 2nd concrete crew</span></div>
              <div>• Zero MahaRERA breach penalty incurred</div>
            </div>
          </div>
        </div>

        {/* Recommendation Summary */}
        <div className="mt-4 p-3 bg-secondary/70 border border-border rounded-[4px]">
          <div className="flex items-center gap-2 text-xs font-semibold font-heading text-foreground">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>AI RECOMMENDATION</span>
          </div>
          <p className="mt-1 text-xs text-foreground leading-relaxed">
            {isCrashCheaper ? (
              <>
                <strong className="text-primary font-medium">Crash critical activities</strong> immediately. This saves{" "}
                <span className="font-mono font-bold text-status-success">
                  <AnimatedNumber value={netSavings} formatter={(v) => formatINR(v)} />
                </span> compared to paying RERA delay penalties and preserves statutory compliance.
              </>
            ) : (
              <>
                <strong className="text-foreground font-medium">Accept RERA penalty</strong>. Crashing labor/equipment costs exceed the calculated statutory penalty by{" "}
                <span className="font-mono font-bold text-destructive">
                  <AnimatedNumber value={netSavings} formatter={(v) => formatINR(v)} />
                </span>.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="pt-2 border-t border-border text-[10px] font-mono text-muted-foreground flex items-center justify-between">
        <span>Formula: Sec 18 MahaRERA 2016</span>
        <span>MCLR: 8.85% + 200 bps</span>
      </div>
    </div>
  )
}
