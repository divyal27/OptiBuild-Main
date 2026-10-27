"use client"

import React, { createContext, useContext, useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { WakeupBanner } from "@/components/layout/WakeupBanner"
import { useAuth } from "@/context/AuthContext"
import { SkeletonCard, SkeletonTable } from "@/components/ui/SkeletonLoader"

interface LayoutContextValue {
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  toggleMobileSidebar: () => void
  closeMobileSidebar: () => void
}

const LayoutContext = createContext<LayoutContextValue>({
  mobileSidebarOpen: false,
  setMobileSidebarOpen: () => {},
  toggleMobileSidebar: () => {},
  closeMobileSidebar: () => {},
})

export function useLayout() {
  return useContext(LayoutContext)
}

export function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, isLoading } = useAuth()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const isLoginPage = pathname === "/login"

  const toggleMobileSidebar = () => setMobileSidebarOpen((prev) => !prev)
  const closeMobileSidebar = () => setMobileSidebarOpen(false)

  if (isLoginPage) {
    return (
      <main className="flex-1 w-full min-h-screen">
        <WakeupBanner />
        {children}
      </main>
    )
  }

  if (isLoading) {
    return (
      <div className="flex-1 min-h-screen bg-background text-foreground flex flex-col p-6 space-y-6">
        <div className="h-12 border-b border-border bg-card/60 flex items-center px-4 rounded-[4px]">
          <div className="w-32 h-4 bg-muted animate-pulse rounded-[2px]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
          <SkeletonCard rows={2} />
        </div>
        <SkeletonTable rows={4} cols={4} />
      </div>
    )
  }

  return (
    <LayoutContext.Provider
      value={{
        mobileSidebarOpen,
        setMobileSidebarOpen,
        toggleMobileSidebar,
        closeMobileSidebar,
      }}
    >
      <div className="flex flex-row w-full min-h-screen bg-background text-foreground overflow-x-hidden">
        <WakeupBanner />
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {children}
        </div>
      </div>
    </LayoutContext.Provider>
  )
}
