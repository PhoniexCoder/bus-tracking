"use client"

import React, { useRef } from "react"
import { cn } from "@/lib/utils"

interface TiltProps extends React.HTMLAttributes<HTMLDivElement> {
  maxTilt?: number // degrees
}

export function TiltCard({ className, children, maxTilt = 8, ...props }: TiltProps) {
  const ref = useRef<HTMLDivElement>(null)

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2
    const dx = (x - cx) / cx
    const dy = (y - cy) / cy
    const rx = dy * maxTilt
    const ry = -dx * maxTilt
    el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`
  }

  const onLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.transform = `perspective(800px) rotateX(0deg) rotateY(0deg)`
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        "transition-transform duration-150 ease-out will-change-transform",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
