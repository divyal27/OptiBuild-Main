"use client"

import React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { CheckCircle2, Circle, ArrowRight, ShieldCheck, Users, FileSpreadsheet, Zap } from "lucide-react"

export interface GuidedStepperProps {
  projectId?: string
  projectName?: string
  hasWbs?: boolean
  hasSchedule?: boolean
  hasOptimizer?: boolean
  memberCount?: number
  currentStep?: 1 | 2 | 3 | 4
}

export function GuidedStepper({
  projectId,
  projectName,
  hasWbs = false,
  hasSchedule = false,
  hasOptimizer = false,
  memberCount = 0,
  currentStep,
}: GuidedStepperProps) {
  const steps = [
    {
      step: 1,
      title: "1. Upload & Confirm",
      subtitle: "MahaRERA PDF verified",
      href: "/rera-review",
      isDone: true, // Project confirmed and created in DB
      icon: ShieldCheck,
    },
    {
      step: 2,
      title: "2. Add Team",
      subtitle: memberCount > 0 ? `${memberCount} members assigned` : "Assign project roles",
      href: "/admin",
      isDone: memberCount > 0,
      icon: Users,
    },
    {
      step: 3,
      title: "3. Building Parameters + WBS",
      subtitle: hasWbs ? "Parametric WBS generated" : "Set area, floors, rate",
      href: "/wbs",
      isDone: Boolean(hasWbs),
      icon: FileSpreadsheet,
    },
    {
      step: 4,
      title: "4. Schedule & Optimizer",
      subtitle: hasSchedule || hasOptimizer ? "CPM + GA & Penalty evaluated" : "Solve delay & penalty",
      href: "/optimizer",
      isDone: Boolean(hasSchedule || hasOptimizer),
      icon: Zap,
    },
  ]

  const completedCount = steps.filter((s) => s.isDone).length
  const progressPercent = Math.round((completedCount / steps.length) * 100)

  return (
    <div className="border border-border bg-card p-4 space-y-4 rounded-[4px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold">
            Guided Project Onboarding Workflow
          </span>
          <h3 className="font-heading font-semibold text-sm text-foreground">
            {projectName ? `Setup Progress: ${projectName}` : "Project Activation Stepper"}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 bg-secondary h-2 border border-border overflow-hidden rounded-[2px]">
            <motion.div
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-primary h-full"
            />
          </div>
          <span className="text-xs font-mono font-bold text-foreground">
            {progressPercent}% Complete
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((s) => {
          const Icon = s.icon
          const isActive = currentStep === s.step
          return (
            <Link
              key={s.step}
              href={s.href}
              className={`p-3 border transition-colors flex flex-col justify-between group rounded-[4px] ${
                s.isDone
                  ? "border-status-success/40 bg-status-success/5 hover:bg-status-success/10"
                  : isActive
                  ? "border-primary bg-primary/5 hover:bg-primary/10"
                  : "border-border bg-background hover:bg-muted/40"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border rounded-[2px] ${
                      s.isDone
                        ? "bg-status-success/20 text-status-success border-status-success/30"
                        : isActive
                        ? "bg-primary/20 text-primary border-primary/30"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    STEP {s.step}
                  </span>
                  {s.isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-status-success" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <h4 className="text-xs font-heading font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>{s.title}</span>
                </h4>
                <p className="text-[11px] font-mono text-muted-foreground mt-1">
                  {s.subtitle}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] font-mono">
                <span className={s.isDone ? "text-status-success font-medium" : "text-muted-foreground"}>
                  {s.isDone ? "Completed" : "Action Required"}
                </span>
                <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
