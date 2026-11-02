"use client"

import React, { useState, useEffect } from "react"
import { getApiUrl } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import { Database, Lock, Sparkles, Check, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface DataConsentCardProps {
  projectId: string
  projectName?: string
}

export function DataConsentCard({ projectId, projectName }: DataConsentCardProps) {
  const { token, hasPermission } = useAuth()
  const [consent, setConsent] = useState<boolean>(false)
  const [telemetry, setTelemetry] = useState<boolean>(false)
  const [consentDate, setConsentDate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isUpdating, setIsUpdating] = useState<boolean>(false)

  const canEdit = hasPermission(["admin", "project_manager"])

  useEffect(() => {
    if (!projectId || !token) return
    setIsLoading(true)
    fetch(getApiUrl(`/api/v1/projects/${projectId}/consent`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setConsent(data.data_sharing_consent || false)
          setTelemetry(data.anonymized_telemetry_opt_in || false)
          setConsentDate(data.consent_given_at || null)
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [projectId, token])

  const handleToggleConsent = async () => {
    if (!canEdit || isUpdating) return
    const newConsent = !consent
    setIsUpdating(true)

    try {
      const res = await fetch(getApiUrl(`/api/v1/projects/${projectId}/consent`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data_sharing_consent: newConsent,
          anonymized_telemetry_opt_in: telemetry,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to update privacy agreement.")
      }

      const updated = await res.json()
      setConsent(updated.data_sharing_consent)
      setConsentDate(updated.consent_given_at)
      if (newConsent) {
        toast.success("Consented to anonymized algorithm training dataset.")
      } else {
        toast.info("Withdrew data sharing consent. Associated training samples purged.")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update consent.")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="border border-border bg-card p-4 rounded-[4px] space-y-4 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <Database className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h3 className="font-heading font-semibold text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
              <span>Algorithmic Telemetry & Training Consent</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 border border-primary/40 bg-primary/10 text-primary rounded-[2px]">
                DPDP ACT 2023
              </span>
            </h3>
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              Opt-in to contribute anonymized project graphs, durations, and floats to train OptiBuild's scheduling and cost engine.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <RefreshCw className="w-4 h-4 text-muted-foreground animate-spin" />
          ) : (
            <button
              type="button"
              disabled={!canEdit || isUpdating}
              onClick={handleToggleConsent}
              className={`px-3 py-1.5 font-mono text-xs font-medium rounded-[2px] transition-colors flex items-center gap-1.5 ${
                consent
                  ? "bg-status-success/20 border border-status-success text-status-success hover:bg-status-success/30"
                  : "bg-muted border border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
            >
              {consent ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>CONSENT ACTIVE</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>OPTED OUT (PRIVATE)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1.5 p-2.5 bg-background border border-border rounded-[2px]">
          <span className="font-mono font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            What is Anonymized & Contributed
          </span>
          <ul className="text-muted-foreground font-sans space-y-1 list-disc pl-4 text-[11px]">
            <li>Task DAG precedence networks and duration distributions</li>
            <li>Normalized masons & machinery resource demand ratios</li>
            <li>Realized material price inflation slopes (₹/day saved)</li>
            <li>Site photo heuristic traits paired with engineer confirmed stages</li>
          </ul>
        </div>

        <div className="space-y-1.5 p-2.5 bg-background border border-border rounded-[2px]">
          <span className="font-mono font-semibold text-status-danger flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            What is NEVER Touched (Locked Guardrails)
          </span>
          <ul className="text-muted-foreground font-sans space-y-1 list-disc pl-4 text-[11px]">
            <li>Developer, promoter, and buyer personal identities (zero PII)</li>
            <li>Architectural CAD drawings (INV-2: strictly attach-only)</li>
            <li>Invoice bill receipts (INV-3: stored as unparsed evidence)</li>
            <li>Exact project GPS coordinates and statutory registration numbers</li>
          </ul>
        </div>
      </div>

      {consentDate && (
        <div className="text-[11px] font-mono text-muted-foreground pt-1 flex items-center justify-between border-t border-border">
          <span>Consent recorded on: {new Date(consentDate).toLocaleDateString()}</span>
          <span className="text-status-success">Cryptographic Salted Hash: Active</span>
        </div>
      )}
    </div>
  )
}
