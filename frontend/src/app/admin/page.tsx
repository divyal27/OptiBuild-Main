"use client"

import React, { useState, useEffect } from "react"
import { getApiUrl } from "@/lib/api"
import { TopBar } from "@/components/layout/TopBar"
import { EmptyState } from "@/components/ui/EmptyState"
import { PermissionDenied } from "@/components/ui/PermissionDenied"
import { useAuth, UserProfile } from "@/context/AuthContext"
import {
  Users,
  UserPlus,
  Shield,
  FolderKanban,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  Building,
  KeyRound,
  ShieldCheck,
} from "lucide-react"
import { motion } from "framer-motion"

interface ProjectMemberInfo {
  id: string
  user_id: string
  user_email?: string
  user_name?: string
  role: string
}

const ROLES = [
  { value: "admin", label: "Admin (Full Access & User Mgmt)" },
  { value: "project_manager", label: "Project Manager (RERA, WBS, Schedules, Crashing)" },
  { value: "site_engineer", label: "Site Engineer (Task Progress & Site Photos)" },
  { value: "store_keeper", label: "Store Keeper (Materials & Bill Photos)" },
  { value: "architect", label: "Architect (View-Only Drawing Attachments)" },
  { value: "accountant", label: "Accountant (Budget vs Actual & Spend Audit)" },
  { value: "owner", label: "Owner (Read-Only Risk & Penalty Dashboard)" },
]

export default function AdminPage() {
  const { user, token, projects, activeProjectId, hasPermission, refreshProjects } = useAuth()

  const [usersList, setUsersList] = useState<UserProfile[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjectId || "")
  const [projectMembers, setProjectMembers] = useState<ProjectMemberInfo[]>([])

  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true)
  const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false)
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false)
  const [isAssigningMember, setIsAssigningMember] = useState<boolean>(false)

  // New user form state
  const [newName, setNewName] = useState<string>("")
  const [newEmail, setNewEmail] = useState<string>("")
  const [newPassword, setNewPassword] = useState<string>("")
  const [newRole, setNewRole] = useState<string>("site_engineer")

  // Assign member form state
  const [assignUserId, setAssignUserId] = useState<string>("")
  const [assignRole, setAssignRole] = useState<string>("site_engineer")

  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Fetch all users
  const fetchUsers = async () => {
    if (!token) return
    setIsLoadingUsers(true)
    setError(null)
    try {
      const res = await fetch(getApiUrl("/api/v1/users"), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        throw new Error("Failed to load user roster.")
      }
      const data = await res.json()
      setUsersList(data || [])
      if (data.length > 0 && !assignUserId) {
        setAssignUserId(data[0].id)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to load users.")
    } finally {
      setIsLoadingUsers(false)
    }
  }

  // Fetch members for selected project
  const fetchProjectMembers = async (projId: string) => {
    if (!token || !projId) {
      setProjectMembers([])
      return
    }
    setIsLoadingMembers(true)
    try {
      const res = await fetch(getApiUrl(`/api/v1/projects/${projId}`), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setProjectMembers(data.members || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoadingMembers(false)
    }
  }

  useEffect(() => {
    if (token && hasPermission(["admin", "project_manager"])) {
      fetchUsers()
    }
  }, [token])

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectMembers(selectedProjectId)
    } else if (projects.length > 0) {
      setSelectedProjectId(projects[0].id)
      fetchProjectMembers(projects[0].id)
    }
  }, [selectedProjectId, projects])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !newName.trim() || !newEmail.trim() || !newPassword) return

    setIsCreatingUser(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await fetch(getApiUrl("/api/v1/users"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          role: newRole,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Failed to create user.")
      }

      const created = await res.json()
      setSuccessMsg(`User ${created.full_name} (${created.email}) created successfully with role ${created.role}.`)
      setNewName("")
      setNewEmail("")
      setNewPassword("")
      fetchUsers()
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to create user.")
    } finally {
      setIsCreatingUser(false)
    }
  }

  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !selectedProjectId || !assignUserId) return

    setIsAssigningMember(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await fetch(getApiUrl(`/api/v1/projects/${selectedProjectId}/members`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: assignUserId,
          role: assignRole,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Failed to assign project member.")
      }

      const resp = await res.json()
      setSuccessMsg(resp.message || "Project membership updated.")
      fetchProjectMembers(selectedProjectId)
      refreshProjects()
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Failed to assign project member.")
    } finally {
      setIsAssigningMember(false)
    }
  }

  // Access check
  if (!hasPermission(["admin", "project_manager"])) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar projectName="Administration" />
        <main className="p-6">
          <PermissionDenied
            title="Administrator / Manager Access Required"
            description="Only Administrators and Project Managers can manage users and assign project team roles."
            requiredRoles={["admin", "project_manager"]}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar projectName="User & Organization Administration" delayRiskDays={0} />

      <main className="p-4 md:p-6 space-y-6 max-w-7xl">
        {/* Admin Overview Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="border border-border bg-card p-4 rounded-[4px] shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <h2 className="font-heading font-semibold text-sm text-foreground uppercase tracking-wider">
                  OptiBuild Security & Access Control
                </h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground font-mono">
                Manage organization users, passwords, and project-level role permissions.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-mono px-2.5 py-1 bg-secondary border border-border text-foreground rounded-[4px] font-medium">
                Organization: OptiBuild Infrastructure Corp
              </span>
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive text-destructive font-mono text-xs flex items-center gap-2 rounded-[4px]">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-status-success/10 border border-status-success text-status-success font-mono text-xs flex items-center gap-2 rounded-[4px]">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Create User Form (Admin Only) */}
        {hasPermission(["admin"]) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            className="border border-border bg-card p-5 rounded-[4px] shadow-sm"
          >
            <h3 className="font-heading font-semibold text-xs text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <UserPlus className="w-3.5 h-3.5 text-primary" />
              Register New User
            </h3>

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1 font-semibold">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs font-mono bg-background border border-border p-2 text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1 font-semibold">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="ramesh@optibuild.io"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full text-xs font-mono bg-background border border-border p-2 text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1 font-semibold">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full text-xs font-mono bg-background border border-border p-2 text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1 font-semibold">
                  Global Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full text-xs font-mono bg-background border border-border p-2 text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isCreatingUser || !newName.trim() || !newEmail.trim() || !newPassword}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground font-mono text-xs font-medium hover:bg-primary/90 transition-colors border border-primary rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                  {isCreatingUser ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      Create User
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}

        {/* User Roster Table */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="border border-border bg-card rounded-[4px] shadow-sm overflow-hidden"
        >
          <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <span className="font-heading font-semibold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-primary" />
              REGISTERED USERS ({usersList.length})
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              Total active accounts in organization
            </span>
          </div>

          {isLoadingUsers ? (
            <div className="flex flex-col items-center justify-center p-10 font-mono text-xs text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary mb-2" />
              Loading users...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[10px] text-muted-foreground uppercase">
                    <th className="p-3 font-semibold">Full Name</th>
                    <th className="p-3 font-semibold">Email</th>
                    <th className="p-3 font-semibold">Global Role</th>
                    <th className="p-3 font-semibold">Account Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usersList.map((u, idx) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: idx * 0.02 }}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 font-bold text-foreground">{u.full_name}</td>
                      <td className="p-3 text-muted-foreground">{u.email}</td>
                      <td className="p-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-secondary border border-border text-foreground font-semibold uppercase rounded-[4px]">
                          {u.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-status-success/15 border border-status-success/30 text-status-success font-medium rounded-[4px]">
                          Active
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Project Membership Assignment Section */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="border border-border bg-card p-5 space-y-4 rounded-[4px] shadow-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div>
              <h3 className="font-heading font-semibold text-xs text-foreground uppercase tracking-wider flex items-center gap-2">
                <FolderKanban className="w-3.5 h-3.5 text-primary" />
                Project Team Assignments
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                Assign users to specific projects with project-scoped roles.
              </p>
            </div>

            {projects.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">Project:</span>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="text-xs font-mono bg-background border border-border p-1.5 text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {projects.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground py-4 text-center">
              No projects created yet. Upload a MahaRERA PDF first to create a project before assigning members.
            </p>
          ) : (
            <>
              {/* Assignment Form */}
              <form onSubmit={handleAssignMember} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1 font-semibold">
                    Select User
                  </label>
                  <select
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    className="w-full text-xs font-mono bg-background border border-border p-2 text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                  >
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase block mb-1 font-semibold">
                    Assigned Project Role
                  </label>
                  <select
                    value={assignRole}
                    onChange={(e) => setAssignRole(e.target.value)}
                    className="w-full text-xs font-mono bg-background border border-border p-2 text-foreground rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isAssigningMember || !selectedProjectId || !assignUserId}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground font-mono text-xs font-medium hover:bg-primary/90 transition-colors border border-primary rounded-[4px] focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    {isAssigningMember ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        Assign Member to Project
                      </>
                    )}
                  </motion.button>
                </div>
              </form>

              {/* Current Project Members Table */}
              <div className="pt-2">
                <span className="text-[10px] font-mono text-muted-foreground uppercase block mb-2 font-semibold">
                  Current Assigned Members ({projectMembers.length})
                </span>

                {isLoadingMembers ? (
                  <div className="flex items-center justify-center p-6 font-mono text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary mr-2" />
                    Loading members...
                  </div>
                ) : projectMembers.length === 0 ? (
                  <div className="p-4 border border-dashed border-border text-center text-xs font-mono text-muted-foreground rounded-[4px]">
                    No users assigned to this project yet. Use the form above to assign members.
                  </div>
                ) : (
                  <div className="border border-border rounded-[4px] overflow-hidden overflow-x-auto shadow-sm">
                    <table className="w-full text-left text-xs font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-[10px] text-muted-foreground uppercase">
                          <th className="p-2.5 font-semibold">User</th>
                          <th className="p-2.5 font-semibold">Email</th>
                          <th className="p-2.5 font-semibold">Project Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {projectMembers.map((m) => (
                          <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-2.5 font-bold text-foreground">{m.user_name || "—"}</td>
                            <td className="p-2.5 text-muted-foreground">{m.user_email || "—"}</td>
                            <td className="p-2.5">
                              <span className="text-[10px] font-mono px-2 py-0.5 bg-primary/10 border border-primary/20 text-primary font-semibold uppercase rounded-[4px]">
                                {m.role.replace("_", " ")}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </main>
    </div>
  )
}
