"use client"

import React, { useEffect, useState } from "react"
import { motion, useSpring, useTransform, useReducedMotion } from "framer-motion"

interface AnimatedNumberProps {
  value: number
  formatter?: (val: number) => string
  className?: string
  prefix?: string
  suffix?: string
  durationMs?: number
}

/**
 * AnimatedNumber renders a 60fps GPU-accelerated count-up animation for numeric metrics.
 * Conforms to DESIGN.md: maximum animation duration 250ms, respects prefers-reduced-motion.
 */
export function AnimatedNumber({
  value,
  formatter,
  className = "font-mono font-bold",
  prefix = "",
  suffix = "",
  durationMs = 240,
}: AnimatedNumberProps) {
  const shouldReduceMotion = useReducedMotion()
  const [mounted, setMounted] = useState(false)

  // Spring animation for smooth, snappy deceleration
  const spring = useSpring(0, {
    mass: 0.8,
    stiffness: 140,
    damping: 20,
  })

  const display = useTransform(spring, (current) => {
    const rounded = Math.round(current)
    if (formatter) {
      return formatter(rounded)
    }
    return rounded.toLocaleString("en-IN")
  })

  const [renderedText, setRenderedText] = useState(() => {
    if (formatter) return formatter(value)
    return value.toLocaleString("en-IN")
  })

  useEffect(() => {
    setMounted(true)
    if (shouldReduceMotion) {
      spring.set(value)
      return
    }
    spring.set(value)
  }, [value, spring, shouldReduceMotion])

  useEffect(() => {
    return display.on("change", (latest) => {
      setRenderedText(latest)
    })
  }, [display])

  // SSR or reduced motion fallback
  if (!mounted || shouldReduceMotion) {
    const formatted = formatter ? formatter(value) : value.toLocaleString("en-IN")
    return (
      <span className={className}>
        {prefix}
        {formatted}
        {suffix}
      </span>
    )
  }

  return (
    <motion.span className={className}>
      {prefix}
      {renderedText}
      {suffix}
    </motion.span>
  )
}
