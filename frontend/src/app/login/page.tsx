"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { useAuth } from "@/context/AuthContext"
import {
  HardHat,
  Shield,
  Briefcase,
  Wrench,
  Package,
  Compass,
  Calculator,
  UserCheck,
  AlertCircle,
  Loader2,
  ArrowRight,
  Lock,
  Mail,
} from "lucide-react"

const DEMO_PRESETS = [
  {
    role: "admin",
    code: "ADMIN",
    title: "System Administrator",
    email: "admin@optibuild.io",
    pass: "Admin@123",
    icon: Shield,
    badge: "All Modules & User Mgmt",
  },
  {
    role: "project_manager",
    code: "PM",
    title: "Project Manager",
    email: "pm@optibuild.io",
    pass: "Pm@123",
    icon: Briefcase,
    badge: "MahaRERA, WBS & Schedule",
  },
  {
    role: "site_engineer",
    code: "SITE",
    title: "Site Engineer",
    email: "site@optibuild.io",
    pass: "Site@123",
    icon: Wrench,
    badge: "Gantt Progress & Site Photos",
  },
  {
    role: "store_keeper",
    code: "STORE",
    title: "Store Keeper",
    email: "store@optibuild.io",
    pass: "Store@123",
    icon: Package,
    badge: "Material Logs & Receipts",
  },
  {
    role: "architect",
    code: "ARCH",
    title: "Lead Architect",
    email: "architect@optibuild.io",
    pass: "Architect@123",
    icon: Compass,
    badge: "CAD/PDF Drawing Vault",
  },
  {
    role: "accountant",
    code: "ACCT",
    title: "Project Accountant",
    email: "accountant@optibuild.io",
    pass: "Accountant@123",
    icon: Calculator,
    badge: "Budget vs Actual Analytics",
  },
  {
    role: "owner",
    code: "OWNER",
    title: "Owner / Developer",
    email: "owner@optibuild.io",
    pass: "Owner@123",
    icon: UserCheck,
    badge: "Executive Risk & Penalties",
  },
]

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError("Please enter both email and password.")
      return
    }

    setError(null)
    setLoading(true)
    const result = await login(email, password)
    if (!result.success) {
      setError(result.error || "Login failed.")
      setLoading(false)
    }
  }

  const handleQuickLogin = async (presetEmail: string, presetPass: string) => {
    setEmail(presetEmail)
    setPassword(presetPass)
    setError(null)
    setLoading(true)
    const result = await login(presetEmail, presetPass)
    if (!result.success) {
      setError(result.error || "Login failed.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background blueprint-grid-bg text-foreground flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="sm:mx-auto sm:w-full sm:max-w-md text-center"
      >
        {/* Brand Logo */}
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground font-mono font-bold text-lg mb-3 rounded-[4px] shadow-sm">
          OB
        </div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">OptiBuild Site Engine OS</h1>
        <p className="mt-1 text-xs font-mono text-muted-foreground uppercase tracking-widest">
          Role-Based Construction Scheduling & Cost Control
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl"
      >
        <div className="bg-card border border-border p-6 sm:p-8 space-y-6 rounded-[4px]">
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 p-3 border border-destructive/50 bg-destructive/10 text-destructive text-xs font-mono rounded-[4px]"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-mono uppercase text-muted-foreground mb-1.5"
              >
                Work Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@optibuild.io"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-background border border-border text-foreground placeholder:text-muted-foreground rounded-[4px] transition-colors focus:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-mono uppercase text-muted-foreground mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-background border border-border text-foreground placeholder:text-muted-foreground rounded-[4px] transition-colors focus:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  required
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground font-mono text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 border border-primary rounded-[4px] cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AUTHENTICATING ROLE...</span>
                </>
              ) : (
                <>
                  <span>SIGN IN TO OPTIBUILD</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </motion.button>
          </form>

          {/* Quick Demo Accounts Selection */}
          <div className="border-t border-border pt-5">
            <div className="text-[11px] font-mono uppercase text-muted-foreground tracking-wider mb-3 flex items-center justify-between">
              <span>Quick Demo Role Logins</span>
              <span className="text-[10px] text-primary font-mono font-semibold">1-Click Sign In</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_PRESETS.map((p) => {
                const Icon = p.icon
                return (
                  <motion.button
                    key={p.role}
                    type="button"
                    disabled={loading}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleQuickLogin(p.email, p.pass)}
                    className="flex items-start gap-2.5 p-2.5 text-left border border-border bg-muted/30 hover:bg-muted/70 hover:border-primary/60 transition-colors disabled:opacity-50 rounded-[4px] cursor-pointer group"
                  >
                    <Icon className="w-4 h-4 text-primary shrink-0 mt-0.5 group-hover:scale-105 transition-transform" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-foreground truncate">{p.title}</span>
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-secondary text-primary border border-border shrink-0">
                          {p.code}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground truncate">{p.badge}</div>
                      <div className="text-[9px] font-mono text-primary/80 mt-0.5">{p.email}</div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-[10px] font-mono text-muted-foreground">
          Protected by OptiBuild RBAC Security Engine • Statutory MahaRERA Enforcement
        </div>
      </motion.div>
    </div>
  )
}
