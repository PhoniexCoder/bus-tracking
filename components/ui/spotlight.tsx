"use client"

import React, { useRef } from "react"
import { cn } from "@/lib/utils"

interface SpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: number // 0.2 - 0.9
}

export function SpotlightCard({
  className,
  children,
  intensity = 0.35,
  ...props
}: SpotlightProps) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    el.style.setProperty("--spot-x", `${x}px`)
    el.style.setProperty("--spot-y", `${y}px`)
  }

  const onLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty("--spot-x", `-100px`)
    el.style.setProperty("--spot-y", `-100px`)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        "relative overflow-hidden rounded-xl",
        // base background
        "bg-white/80 backdrop-blur",
        // spotlight overlay
        "before:pointer-events-none before:absolute before:inset-0 before:content-['']",
        "before:bg-[radial-gradient(200px_circle_at_var(--spot-x)_var(--spot-y),rgba(59,130,246,",
        `${intensity},0)_0%,rgba(59,130,246,0)_60%)]`,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
