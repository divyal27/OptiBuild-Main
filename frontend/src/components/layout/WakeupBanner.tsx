"use client"

import React, { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2 } from "lucide-react"
import { onWakeupStateChange } from "@/lib/api"

export function WakeupBanner() {
  const [isWakingUp, setIsWakingUp] = useState(false)

  useEffect(() => {
    return onWakeupStateChange((waking) => {
      setIsWakingUp(waking)
    })
  }, [])

  return (
    <AnimatePresence>
      {isWakingUp && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed top-0 left-0 right-0 z-[99999] bg-[#E8590C] text-white px-4 py-2.5 text-xs font-mono font-semibold flex items-center justify-center gap-2 shadow-2xl border-b border-white/20 tracking-wide"
        >
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-white" />
          <span>Waking up the server, please wait...</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
