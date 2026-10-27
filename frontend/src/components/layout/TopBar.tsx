"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertTriangle,
  Clock,
  RefreshCw,
  Menu,
  ChevronDown,
  User,
  Shield,
  Briefcase,
  Wrench,
  Package,
  Compass,
  Calculator,
  UserCheck,
  Check,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useLayout } from "@/components/layout/ClientLayoutWrapper"

const DEMO_ROLES = [
  { role: "admin", code: "ADMIN", title: "System Administrator", email: "admin@optibuild.io", pass: "Admin@123", icon: Shield },
  { role: "project_manager", code: "PM", title: "Project Manager", email: "pm@optibuild.io", pass: "Pm@123", icon: Briefcase },
  { role: "site_engineer", code: "SITE", title: "Site Engineer", email: "site@optibuild.io", pass: "Site@123", icon: Wrench },
  { role: "store_keeper", code: "STORE", title: "Store Keeper", email: "store@optibuild.io", pass: "Store@123", icon: Package },
  { role: "architect", code: "ARCH", title: "Lead Architect", email: "architect@optibuild.io", pass: "Architect@123", icon: Compass },
  { role: "accountant", code: "ACCT", title: "Project Accountant", email: "accountant@optibuild.io", pass: "Accountant@123", icon: Calculator },
  { role: "owner", code: "OWNER", title: "Owner / Developer", email: "owner@optibuild.io", pass: "Owner@123", icon: UserCheck },
]

interface TopBarProps {
  projectName?: string
  delayRiskDays?: number
  completionDate?: string
  reraNo?: string
  onRecalculate?: () => void
  isOptimizing?: boolean
}

export function TopBar({
  projectName,
  delayRiskDays,
  completionDate,
  reraNo,
  onRecalculate,
  isOptimizing = false,
}: TopBarProps) {
  const { user, activeProject, login } = useAuth()
  const { toggleMobileSidebar } = useLayout()
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayName = projectName || activeProject?.name || "No Project Selected"
  const delayDays = delayRiskDays !== undefined ? delayRiskDays : activeProject?.delay_days || 0
  const isDelayed = delayDays > 0
  const displayRera = reraNo || activeProject?.rera_registration_no || "UNREGISTERED"
  const targetDate = completionDate || activeProject?.proposed_completion_date || "TBD"

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowRoleMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleRoleSwitch = async (email: string, pass: string) => {
    setShowRoleMenu(false)
    await login(email, pass)
  }

  return (
    <header className="h-13 border-b border-border bg-card/90 backdrop-blur-sm px-3 sm:px-4 flex items-center justify-between sticky top-0 z-30 select-none">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={toggleMobileSidebar}
          aria-label="Toggle navigation menu"
          className="md:hidden p-1.5 border border-border bg-card hover:bg-muted text-foreground rounded-[4px] cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-baseline gap-2 truncate">
          <h1 className="text-xs sm:text-sm font-semibold tracking-tight font-heading text-foreground truncate max-w-[150px] sm:max-w-xs md:max-w-md">
            {displayName}
          </h1>
          <span className="text-[10px] sm:text-[11px] font-mono text-muted-foreground hidden sm:inline shrink-0">
            RERA: {displayRera}
          </span>
        </div>

        {/* Delay Risk Badge */}
        {activeProject && (
          isDelayed ? (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 border border-destructive/40 bg-destructive/10 text-destructive text-[10px] sm:text-[11px] font-mono font-medium rounded-[4px] shrink-0">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>DELAY: +{delayDays}d</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 border border-status-success/40 bg-status-success/10 text-status-success text-[10px] sm:text-[11px] font-mono font-medium rounded-[4px] shrink-0">
              <Clock className="w-3.5 h-3.5" />
              <span>ON SCHEDULE</span>
            </div>
          )
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {activeProject && (
          <div className="text-right text-[11px] font-mono mr-1 hidden xl:block">
            <span className="text-muted-foreground">Target Handover: </span>
            <span className="font-semibold text-foreground">{targetDate}</span>
          </div>
        )}

        {onRecalculate && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onRecalculate}
            disabled={isOptimizing}
            className="flex items-center gap-1.5 text-xs font-mono font-medium bg-primary text-primary-foreground px-2.5 py-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50 border border-primary rounded-[4px] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isOptimizing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{isOptimizing ? "SOLVING GA..." : "RUN OPTIMIZER"}</span>
            <span className="sm:hidden">SOLVE</span>
          </motion.button>
        )}

        {/* Active Role & 1-Click Role Switcher Demo Menu */}
        <div className="relative" ref={menuRef}>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            type="button"
            className="flex items-center gap-1.5 px-2 py-1 text-xs border border-border bg-muted/40 hover:bg-muted text-foreground rounded-[4px] transition-colors cursor-pointer"
            title="Click to switch demo role"
          >
            <span className="text-[9px] sm:text-[10px] font-mono uppercase px-1.5 py-0.5 bg-primary/15 text-primary border border-primary/30 font-bold rounded-[2px]">
              {user?.role ? user.role.replace("_", " ") : "ROLE"}
            </span>
            <span className="text-xs font-sans font-medium hidden md:inline max-w-[100px] truncate">
              {user?.full_name || "Account"}
            </span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </motion.button>

          <AnimatePresence>
            {showRoleMenu && (
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-10 w-64 bg-card border border-border shadow-xl z-50 rounded-[4px] overflow-hidden"
              >
                <div className="p-2 border-b border-border bg-muted/30">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Switch Demo Role (1-Click)
                  </div>
                  <div className="text-[11px] font-medium text-foreground truncate mt-0.5">
                    Currently: <span className="text-primary font-mono">{user?.full_name}</span>
                  </div>
                </div>

                <div className="p-1 max-h-72 overflow-y-auto divide-y divide-border/40">
                  {DEMO_ROLES.map((r) => {
                    const isCurrent = user?.role === r.role
                    const Icon = r.icon
                    return (
                      <button
                        key={r.role}
                        type="button"
                        onClick={() => handleRoleSwitch(r.email, r.pass)}
                        className={`w-full flex items-center justify-between p-2 text-left text-xs transition-colors rounded-[2px] cursor-pointer ${
                          isCurrent
                            ? "bg-secondary text-primary font-semibold"
                            : "hover:bg-muted/70 text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                          <div className="truncate">
                            <div className="truncate">{r.title}</div>
                            <div className="text-[9px] font-mono text-muted-foreground truncate">{r.email}</div>
                          </div>
                        </div>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />}
                      </button>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
