"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface SkeletonLineProps {
  className?: string
  width?: string
  height?: string
}

export function SkeletonLine({
  className,
  width = "w-full",
  height = "h-4",
}: SkeletonLineProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-muted/60 rounded-[2px] border border-border/30",
        width,
        height,
        className
      )}
      aria-hidden="true"
    />
  )
}

interface SkeletonCardProps {
  className?: string
  rows?: number
}

export function SkeletonCard({ className, rows = 3 }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "border border-border bg-card p-4 space-y-3 rounded-[4px]",
        className
      )}
      aria-busy="true"
      aria-label="Loading content"
    >
      <div className="flex items-center justify-between">
        <SkeletonLine width="w-1/3" height="h-3" />
        <SkeletonLine width="w-8" height="h-3" />
      </div>
      <SkeletonLine width="w-1/2" height="h-7" />
      <div className="space-y-1.5 pt-1">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonLine key={i} width={i % 2 === 0 ? "w-3/4" : "w-1/2"} height="h-2.5" />
        ))}
      </div>
    </div>
  )
}

interface SkeletonTableProps {
  rows?: number
  cols?: number
  className?: string
}

export function SkeletonTable({ rows = 5, cols = 4, className }: SkeletonTableProps) {
  return (
    <div
      className={cn("border border-border bg-card overflow-hidden rounded-[4px]", className)}
      aria-busy="true"
      aria-label="Loading table data"
    >
      {/* Header bar */}
      <div className="bg-muted/40 px-4 py-2.5 border-b border-border flex items-center gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width="w-24" height="h-3" />
        ))}
      </div>
      {/* Table rows */}
      <div className="divide-y divide-border/40 p-2 space-y-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 py-2 px-2">
            {Array.from({ length: cols }).map((_, c) => (
              <SkeletonLine
                key={c}
                width={c === 0 ? "w-16" : c === 1 ? "w-48" : "w-20"}
                height="h-3"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
