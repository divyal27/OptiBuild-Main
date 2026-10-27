"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  CalendarDays,
  BarChart3,
  TrendingDown,
  FileSpreadsheet,
  FileCheck2,
  Receipt,
  PieChart,
  HardHat,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
  FolderKanban,
  FileUp,
  ShieldAlert,
  Users,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"
import { useLayout } from "@/components/layout/ClientLayoutWrapper"

interface NavItem {
  name: string
  href: string
  icon: any
  tag?: string
  roles: string[]
}

const ALL_NAV_ITEMS: NavItem[] = [
  {
    name: "Gantt Schedule",
    href: "/",
    icon: CalendarDays,
    tag: "HERO",
    roles: ["admin", "project_manager", "site_engineer"],
  },
  {
    name: "MahaRERA Review",
    href: "/rera-review",
    icon: FileCheck2,
    tag: "SETUP",
    roles: ["admin", "project_manager"],
  },
  {
    name: "WBS & Cost Estimation",
    href: "/wbs",
    icon: FileSpreadsheet,
    roles: ["admin", "project_manager"],
  },
  {
    name: "Penalty vs Crash Cost",
    href: "/optimizer",
    icon: TrendingDown,
    roles: ["admin", "project_manager"],
  },
  {
    name: "GA vs CP-SAT Benchmark",
    href: "/benchmark",
    icon: BarChart3,
    roles: ["admin", "project_manager"],
  },
  {
    name: "Material & Cost Log",
    href: "/materials",
    icon: Receipt,
    roles: ["admin", "store_keeper", "accountant", "site_engineer"],
  },
  {
    name: "Budget vs Actual",
    href: "/dashboard",
    icon: PieChart,
    roles: ["admin", "accountant", "owner", "project_manager"],
  },
  {
    name: "Drawing Vault",
    href: "/drawings",
    icon: FolderKanban,
    tag: "CAD",
    roles: ["admin", "architect", "project_manager", "site_engineer"],
  },
  {
    name: "User & Team Mgmt",
    href: "/admin",
    icon: Users,
    roles: ["admin"],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout, projects, activeProjectId, activeProject, setActiveProjectId } = useAuth()
  const { mobileSidebarOpen, closeMobileSidebar } = useLayout()
  const [isDark, setIsDark] = useState(false)
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle("dark")
  }

  // Filter navigation items by role permissions
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) => {
    if (!user) return false
    if (user.role === "admin") return true
    return item.roles.includes(user.role)
  })

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full min-h-0 bg-card select-none">
      <div className="flex flex-col min-h-0">
        {/* Site Header / Project Brand */}
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary rounded-[2px] flex items-center justify-center text-primary-foreground font-mono font-bold text-xs tracking-wider">
              OB
            </div>
            <div>
              <div className="font-heading font-semibold text-sm tracking-tight text-foreground flex items-center gap-1.5">
                OptiBuild
                <span className="text-[9px] uppercase font-mono px-1 py-0.2 bg-secondary border border-border text-primary font-bold rounded-[2px]">
                  RBAC
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">SITE ENGINE OS</div>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={closeMobileSidebar}
            aria-label="Close sidebar"
            className="md:hidden p-1 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Project Switcher */}
        <div className="p-3 border-b border-border bg-muted/30 relative shrink-0">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Active Project</span>
            {projects.length > 0 && (
              <span className="text-[9px] text-primary font-mono">{projects.length} in DB</span>
            )}
          </div>

          {projects.length > 0 ? (
            <div>
              <button
                type="button"
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs bg-card border border-border text-foreground hover:bg-muted/70 transition-colors text-left rounded-[4px] cursor-pointer"
              >
                <div className="truncate">
                  <div className="font-medium truncate">{activeProject?.name || "Select Project"}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {activeProject?.rera_registration_no || "Registered Project"}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1" />
              </button>

              <AnimatePresence>
                {showProjectDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-3 right-3 top-16 bg-card border border-border shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-border rounded-[4px]"
                  >
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setActiveProjectId(p.id)
                          setShowProjectDropdown(false)
                        }}
                        className={cn(
                          "w-full px-3 py-2 text-left text-xs transition-colors hover:bg-secondary/70 cursor-pointer",
                          p.id === activeProjectId ? "bg-secondary text-primary font-semibold" : "text-foreground"
                        )}
                      >
                        <div className="truncate">{p.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {p.rera_registration_no || "Registered"}
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="px-2.5 py-2 bg-card border border-dashed border-border text-center rounded-[4px]">
              <div className="text-[11px] font-mono text-muted-foreground">No Projects in DB</div>
              {(user?.role === "project_manager" || user?.role === "admin") && (
                <Link
                  href="/rera-review"
                  onClick={closeMobileSidebar}
                  className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:underline"
                >
                  <FileUp className="w-3 h-3" />
                  <span>Upload MahaRERA PDF</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-2 space-y-0.5 overflow-y-auto flex-1">
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
            Permitted Modules
          </div>
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobileSidebar}
                className={cn(
                  "flex items-center justify-between px-2.5 py-2 text-xs transition-colors rounded-[4px] border border-transparent font-sans",
                  isActive
                    ? "bg-secondary text-primary font-medium border-border shadow-xs"
                    : "text-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="truncate">{item.name}</span>
                </div>
                {item.tag && (
                  <span className="text-[9px] font-mono uppercase px-1 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-[2px]">
                    {item.tag}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* User Profile & Footer Info */}
      <div className="p-3 border-t border-border bg-muted/20 space-y-2 shrink-0">
        {user && (
          <div className="p-2 border border-border bg-card flex items-center justify-between rounded-[4px]">
            <div className="min-w-0 pr-2">
              <div className="text-xs font-semibold truncate text-foreground">{user.full_name}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] uppercase font-mono px-1 py-0.2 bg-primary/10 text-primary border border-primary/20 rounded-[2px] font-semibold">
                  {user.role.replace("_", " ")}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout of OptiBuild"
              type="button"
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/30 transition-colors rounded-[4px] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-[10px] font-mono text-muted-foreground">
            Theme: {isDark ? "Dark Terminal" : "Paper Blueprint"}
          </span>
          <button
            onClick={toggleTheme}
            className="p-1 border border-border hover:bg-secondary transition-colors rounded-[4px] cursor-pointer"
            title="Toggle Blueprint / Dark Theme"
            type="button"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border shrink-0 select-none h-screen sticky top-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer with Backdrop */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={closeMobileSidebar}
              className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="md:hidden fixed top-0 bottom-0 left-0 z-50 w-64 border-r border-border shadow-2xl"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
