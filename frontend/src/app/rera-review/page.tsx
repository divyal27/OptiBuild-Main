"use client"

import React, { useState } from "react"
import { useDropzone } from "react-dropzone"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { getApiUrl } from "@/lib/api"
import { TopBar } from "@/components/layout/TopBar"
import { EmptyState } from "@/components/ui/EmptyState"
import { PermissionDenied } from "@/components/ui/PermissionDenied"
import { GuidedStepper } from "@/components/project/GuidedStepper"
import { useAuth } from "@/context/AuthContext"
import { formatINR } from "@/lib/utils"
import {
  FileCheck2,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Building,
  Calendar,
  Layers,
  Coins,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  PlusCircle,
  Loader2,
} from "lucide-react"

interface ReraDraftData {
  project_name: string
  rera_registration_no: string
  promoter_name: string
  proposed_completion_date: string
  plot_area_sqft: number
  built_up_area_sqft: number
  carpet_area_sqft: number
  number_of_floors: number
  number_of_basements: number
  total_project_cost: number
  raw_pdf_url?: string
  confidence_scores: Record<string, string>
}

const EMPTY_DRAFT: ReraDraftData = {
  project_name: "",
  rera_registration_no: "",
  promoter_name: "",
  proposed_completion_date: "",
  plot_area_sqft: 0,
  built_up_area_sqft: 0,
  carpet_area_sqft: 0,
  number_of_floors: 1,
  number_of_basements: 0,
  total_project_cost: 0,
  confidence_scores: {},
}

export default function ReraReviewPage() {
  const { user, token, hasPermission, refreshProjects, setActiveProjectId } = useAuth()
  const router = useRouter()

  const [formData, setFormData] = useState<ReraDraftData | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmedProject, setConfirmedProject] = useState<{ id: string; name: string } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [userNotes, setUserNotes] = useState("")

  // Permission check
  if (!hasPermission(["project_manager", "admin"])) {
    return (
      <div className="flex flex-col min-h-screen">
        <TopBar projectName="MahaRERA Project Registration" />
        <main className="p-6">
          <PermissionDenied
            title="Project Manager Access Required"
            description="Only Project Managers and Administrators are authorized to parse MahaRERA certificates and register projects."
            requiredRoles={["project_manager", "admin"]}
          />
        </main>
      </div>
    )
  }

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return
    const file = acceptedFiles[0]
    setFileName(file.name)
    setIsParsing(true)
    setErrorMessage(null)
    setConfirmedProject(null)

    try {
      const body = new FormData()
      body.append("file", file)

      const res = await fetch(getApiUrl("/api/v1/rera/upload-parse"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      })

      if (!res.ok) {
        throw new Error("Failed to parse uploaded PDF. Opening manual entry form.")
      }

      const draft = await res.json()
      setFormData({
        project_name: draft.project_name || "",
        rera_registration_no: draft.rera_registration_no || "",
        promoter_name: draft.promoter_name || "",
        proposed_completion_date: draft.proposed_completion_date || "",
        plot_area_sqft: draft.plot_area_sqft || 0,
        built_up_area_sqft: draft.built_up_area_sqft || 0,
        carpet_area_sqft: draft.carpet_area_sqft || 0,
        number_of_floors: draft.number_of_floors || 1,
        number_of_basements: draft.number_of_basements || 0,
        total_project_cost: draft.total_project_cost || 0,
        raw_pdf_url: draft.raw_pdf_url,
        confidence_scores: draft.confidence_scores || {},
      })
    } catch (err: any) {
      setErrorMessage(err.message || "Parsing failed. You can enter details manually below.")
      setFormData(EMPTY_DRAFT)
    } finally {
      setIsParsing(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
  })

  const handleStartManualEntry = () => {
    setFileName("manual_entry.pdf")
    setFormData(EMPTY_DRAFT)
    setErrorMessage(null)
    setConfirmedProject(null)
  }

  const handleConfirm = async () => {
    if (!formData) return
    if (!formData.project_name || !formData.rera_registration_no) {
      setErrorMessage("Project Name and MahaRERA Registration Number are required.")
      return
    }

    setIsConfirming(true)
    setErrorMessage(null)

    try {
      const res = await fetch(getApiUrl("/api/v1/rera/confirm"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...formData,
          user_notes: userNotes,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || "Failed to confirm and create project.")
      }

      const data = await res.json()
      setConfirmedProject({ id: data.project_id, name: data.project_name })
      setActiveProjectId(data.project_id)
      await refreshProjects()
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to confirm project.")
    } finally {
      setIsConfirming(false)
    }
  }

  const renderConfidenceBadge = (fieldKey: string) => {
    if (!formData) return null
    const score = formData.confidence_scores[fieldKey] || "MANUAL"
    if (score === "HIGH") {
      return (
        <span className="text-[9px] font-mono px-1.5 py-0.2 bg-status-success/15 text-status-success border border-status-success/30 rounded-[2px] font-semibold">
          HIGH CONFIDENCE
        </span>
      )
    }
    if (score === "INFERRED" || score === "MEDIUM") {
      return (
        <span className="text-[9px] font-mono px-1.5 py-0.2 bg-status-warning/15 text-status-warning border border-status-warning/30 rounded-[2px] font-semibold">
          INFERRED • VERIFY
        </span>
      )
    }
    return (
      <span className="text-[9px] font-mono px-1.5 py-0.2 bg-muted text-muted-foreground border border-border rounded-[2px] font-semibold">
        MANUAL INPUT
      </span>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar
        projectName={formData?.project_name ? `MahaRERA: ${formData.project_name}` : "MahaRERA Project Setup"}
        delayRiskDays={0}
      />

      <main className="p-4 md:p-6 space-y-6 max-w-5xl">
        {/* Compulsory Review Alert */}
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="border border-status-warning/40 bg-status-warning/10 p-4 flex items-start gap-3 rounded-[4px]"
        >
          <ShieldAlert className="w-5 h-5 text-status-warning shrink-0 mt-0.5" />
          <div className="text-xs">
            <h2 className="font-heading font-semibold text-foreground uppercase tracking-wider">
              Statutory MahaRERA Verification Protocol
            </h2>
            <p className="mt-1 text-muted-foreground leading-relaxed font-sans">
              MahaRERA PDF parsing strictly pre-fills a draft. It never auto-commits to your database.
              As Project Manager, you must review, edit where required, and explicitly click Confirm to create the project.
            </p>
          </div>
        </motion.div>

        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 border border-destructive/50 bg-destructive/10 text-destructive text-xs font-mono rounded-[4px]"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Confirmed Project Success Banner & Guided Stepper */}
        <AnimatePresence>
          {confirmedProject && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="space-y-4"
            >
              <div className="border border-status-success/50 bg-status-success/10 p-5 space-y-3 rounded-[4px]">
                <div className="flex items-center gap-2 text-status-success font-heading font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Project Successfully Confirmed & Created in Database!</span>
                </div>
                <p className="text-xs font-mono text-foreground">
                  Project Name: <span className="font-bold">{confirmedProject.name}</span> (ID: {confirmedProject.id})
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => {
                      setFormData(null)
                      setFileName(null)
                      setConfirmedProject(null)
                    }}
                    className="px-3 py-1.5 border border-border bg-card text-foreground font-mono text-xs hover:bg-muted transition-colors rounded-[4px] cursor-pointer"
                  >
                    Create Another Project
                  </motion.button>
                </div>
              </div>

              <GuidedStepper
                projectId={confirmedProject.id}
                projectName={confirmedProject.name}
                currentStep={1}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Dropzone */}
        {!confirmedProject && (
          <div className="space-y-3">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors rounded-[4px] ${
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-muted/30"
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center space-y-2">
                {isParsing ? (
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                ) : (
                  <UploadCloud className="w-8 h-8 text-primary" />
                )}
                <div className="text-xs font-mono font-medium text-foreground">
                  {isParsing
                    ? "Parsing certificate with pdfplumber & extracting statutory attributes..."
                    : isDragActive
                    ? "Drop the MahaRERA PDF certificate here..."
                    : "Drag & drop MahaRERA Registration Certificate (PDF) or click to browse"}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  Extracts project title, registration number, promoter name, sanctioned FSI area, floors, and completion date
                </div>
                {fileName && (
                  <div className="mt-2 text-xs font-mono px-2.5 py-1 bg-secondary border border-border text-foreground flex items-center gap-1.5 rounded-[2px]">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>{fileName}</span>
                  </div>
                )}
              </div>
            </div>

            {!formData && !isParsing && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleStartManualEntry}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Or create project by entering parameters manually</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Pre-Filled Verification Form */}
        {formData && !confirmedProject && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="bg-card border border-border p-5 space-y-6 rounded-[4px]"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-heading font-semibold text-sm text-foreground">
                  Review & Confirm Extracted Project Specifications
                </h3>
                <p className="text-[11px] font-mono text-muted-foreground">
                  All fields are editable. Verify against sanctioned Annexure drawings before confirming.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData(null)}
                className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Project Name */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label htmlFor="field-project-name" className="text-foreground font-medium">Project Name *</label>
                  {renderConfidenceBadge("project_name")}
                </div>
                <input
                  id="field-project-name"
                  type="text"
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  placeholder="e.g. Emerald Heights Tower A"
                  className="w-full px-3 py-2 text-xs font-mono bg-background border border-border text-foreground rounded-[4px] focus:outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                  required
                />
              </div>

              {/* RERA Number */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label htmlFor="field-rera-no" className="text-foreground font-medium">MahaRERA Registration No *</label>
                  {renderConfidenceBadge("rera_registration_no")}
                </div>
                <input
                  id="field-rera-no"
                  type="text"
                  value={formData.rera_registration_no}
                  onChange={(e) => setFormData({ ...formData, rera_registration_no: e.target.value })}
                  placeholder="e.g. P52100018921"
                  className="w-full px-3 py-2 text-xs font-mono bg-background border border-border text-foreground rounded-[4px] focus:outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                  required
                />
              </div>

              {/* Promoter Name */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label htmlFor="field-promoter-name" className="text-foreground font-medium">Promoter / Developer Name</label>
                  {renderConfidenceBadge("promoter_name")}
                </div>
                <input
                  id="field-promoter-name"
                  type="text"
                  value={formData.promoter_name}
                  onChange={(e) => setFormData({ ...formData, promoter_name: e.target.value })}
                  placeholder="e.g. Solitaire Infra Projects Pvt Ltd"
                  className="w-full px-3 py-2 text-xs font-mono bg-background border border-border text-foreground rounded-[4px] focus:outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              {/* Handover Date */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label htmlFor="field-handover-date" className="text-foreground font-medium">Proposed Handover Date *</label>
                  {renderConfidenceBadge("proposed_completion_date")}
                </div>
                <input
                  id="field-handover-date"
                  type="text"
                  value={formData.proposed_completion_date}
                  onChange={(e) => setFormData({ ...formData, proposed_completion_date: e.target.value })}
                  placeholder="DD/MM/YYYY or YYYY-MM-DD"
                  className="w-full px-3 py-2 text-xs font-mono bg-background border border-border text-foreground rounded-[4px] focus:outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                  required
                />
              </div>

              {/* Built-up Area */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label htmlFor="field-bu-area" className="text-foreground font-medium">Sanctioned Built-Up Area (sq.ft) *</label>
                  {renderConfidenceBadge("built_up_area_sqft")}
                </div>
                <input
                  id="field-bu-area"
                  type="number"
                  value={formData.built_up_area_sqft || ""}
                  onChange={(e) => setFormData({ ...formData, built_up_area_sqft: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 75000"
                  className="w-full px-3 py-2 text-xs font-mono bg-background border border-border text-foreground rounded-[4px] focus:outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                  required
                />
              </div>

              {/* Number of Floors */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label htmlFor="field-floors" className="text-foreground font-medium">Number of Floors (G+X) *</label>
                  {renderConfidenceBadge("number_of_floors")}
                </div>
                <input
                  id="field-floors"
                  type="number"
                  value={formData.number_of_floors || ""}
                  onChange={(e) => setFormData({ ...formData, number_of_floors: parseInt(e.target.value, 10) || 1 })}
                  placeholder="e.g. 14"
                  className="w-full px-3 py-2 text-xs font-mono bg-background border border-border text-foreground rounded-[4px] focus:outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                  required
                />
              </div>

              {/* Basements */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label htmlFor="field-basements" className="text-foreground font-medium">Number of Basements</label>
                  {renderConfidenceBadge("number_of_basements")}
                </div>
                <input
                  id="field-basements"
                  type="number"
                  value={formData.number_of_basements || ""}
                  onChange={(e) => setFormData({ ...formData, number_of_basements: parseInt(e.target.value, 10) || 0 })}
                  placeholder="e.g. 1"
                  className="w-full px-3 py-2 text-xs font-mono bg-background border border-border text-foreground rounded-[4px] focus:outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              {/* Total Estimated Cost */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label htmlFor="field-cost" className="text-foreground font-medium">Estimated Project Cost (INR)</label>
                  {renderConfidenceBadge("total_project_cost")}
                </div>
                <input
                  id="field-cost"
                  type="number"
                  value={formData.total_project_cost || ""}
                  onChange={(e) => setFormData({ ...formData, total_project_cost: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g. 180000000"
                  className="w-full px-3 py-2 text-xs font-mono bg-background border border-border text-foreground rounded-[4px] focus:outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                />
                {formData.total_project_cost > 0 && (
                  <div className="text-[10px] font-mono text-muted-foreground">
                    Approx: {formatINR(formData.total_project_cost)}
                  </div>
                )}
              </div>
            </div>

            {/* Engineer Notes */}
            <div className="space-y-1">
              <label htmlFor="field-notes" className="block text-xs font-mono text-muted-foreground">
                Verification Notes & Annexure Reference
              </label>
              <textarea
                id="field-notes"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Verified against sanctioned layout drawing dated 25-Oct-2026."
                className="w-full px-3 py-2 text-xs font-mono bg-background border border-border text-foreground rounded-[4px] focus:outline-none focus:border-primary focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            {/* Confirm & Save Button */}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <div className="text-[11px] font-mono text-muted-foreground">
                Clicking Confirm permanently registers the project into database tables.
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                disabled={isConfirming}
                onClick={handleConfirm}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-mono text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 border border-primary shadow-sm rounded-[4px] cursor-pointer"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>SAVING PROJECT TO DB...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>CONFIRM & CREATE PROJECT</span>
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}
