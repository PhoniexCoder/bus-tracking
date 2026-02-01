"use client"

import React, { useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface RippleButtonProps extends React.ComponentProps<typeof Button> {}

export function RippleButton({ className, children, ...props }: RippleButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (props.onClick) props.onClick(e)
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const ripple = document.createElement("span")
    ripple.className = "absolute rounded-full bg-white/60 animate-[ripple_600ms_ease-out_forwards]"
    const size = Math.max(rect.width, rect.height)
    ripple.style.width = `${size}px`
    ripple.style.height = `${size}px`
    ripple.style.left = `${x - size / 2}px`
    ripple.style.top = `${y - size / 2}px`
    ripple.style.pointerEvents = "none"
    el.appendChild(ripple)
    setTimeout(() => ripple.remove(), 650)
  }

  return (
    <Button
      ref={ref}
      onClick={onClick}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      {children}
    </Button>
  )
}
