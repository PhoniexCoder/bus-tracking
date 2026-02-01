'use client'

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { FirestoreService } from "@/lib/firestore"
import { Badge } from "@/components/ui/badge"
import {
  Bus,
  MapPin,
  Clock,
  Activity,
  Sparkles,
  Search,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { RippleButton } from "@/components/ui/ripple-button"
import { SpotlightCard } from "@/components/ui/spotlight"

export default function HomePage() {
  const { loading, user } = useAuth()
  const router = useRouter()
  const [busNo, setBusNo] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const popularBusNos = useMemo(
    () => ["06", "26"],
    []
  )

  const handleTrack = async () => {
    const v = busNo.trim()
    if (!v) return
    setSubmitting(true)
    try {
      // Persist chosen bus to the user's profile
      if (user?.uid) {
        const fs = new FirestoreService(user.uid)
        await fs.setAssignedBus(v)
      }
      router.push(`/parent/dashboard?busId=${encodeURIComponent(v)}`)
    } finally {
      setTimeout(() => setSubmitting(false), 800)
    }
  }

  // On future visits, auto-redirect if an assigned bus exists
  useEffect(() => {
    let canceled = false
    const run = async () => {
      if (loading) return
      if (!user?.uid) return
      try {
        const fs = new FirestoreService(user.uid)
        const profile = await fs.getStudentProfile()
        const assigned = profile?.assignedBusId
        if (!canceled && assigned) {
          router.replace(`/parent/dashboard?busId=${encodeURIComponent(assigned)}`)
        }
      } catch (e) {
        // Non-blocking: if Firestore fails, we just don't redirect
        console.warn("Auto-redirect check failed:", e)
      }
    }
    run()
    return () => {
      canceled = true
    }
  }, [loading, user?.uid, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <Bus className="h-12 w-12 text-blue-400 animate-bounce" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
      {/* Background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-white/10 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/20 rounded-lg">
                <Bus className="h-5 w-5 text-blue-400" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                BusTracker
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Centered */}
      <main className="relative z-10 flex-1 flex flex-col justify-center px-4 sm:px-6 py-8">
        <div className="max-w-xl mx-auto w-full">
          {/* Hero */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4 text-xs">
              <Sparkles className="h-3 w-3 text-blue-400" />
              <span className="text-blue-300">Real-time GPS tracking</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">
              <span className="bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                Track Your Child's Bus
              </span>
            </h1>
            <p className="text-sm text-slate-400">
              Instant location updates, accurate ETAs, and peace of mind.
            </p>
          </div>

          {/* Tracking Card */}
          <SpotlightCard className="border border-white/10 bg-white/5 backdrop-blur-xl p-6 rounded-2xl mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Search className="h-5 w-5 text-blue-400" />
              <span className="font-medium">Enter bus number</span>
            </div>

            <div className="flex gap-2 mb-3">
              <Input
                id="busNo"
                aria-label="Bus number"
                placeholder="e.g., 26"
                value={busNo}
                onChange={(e) => setBusNo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleTrack()
                  }
                }}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-blue-500 h-11"
              />
              <RippleButton
                onClick={handleTrack}
                disabled={!busNo.trim() || submitting}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white h-11 px-6"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="flex items-center gap-1.5">
                    Save <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </RippleButton>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Quick:</span>
              {popularBusNos.map((b) => (
                <Badge
                  key={b}
                  variant="secondary"
                  className="cursor-pointer bg-white/5 border-white/10 text-slate-300 hover:bg-blue-500/20 hover:text-blue-300 transition-all text-xs"
                  onClick={() => setBusNo(b)}
                >
                  {b}
                </Badge>
              ))}
            </div>
          </SpotlightCard>

          {/* Features - Compact Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              { icon: Activity, label: "Real-time" },
              { icon: MapPin, label: "GPS Location" },
              { icon: Clock, label: "Accurate ETA" },
              { icon: Shield, label: "Private" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                <f.icon className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="text-xs text-slate-300">{f.label}</span>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            {["Instant access"].map((item, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer - Minimal */}
      <footer className="relative z-10 border-t border-white/10 py-4 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-center text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Bus className="h-4 w-4 text-blue-400" />
            <span className="font-medium text-slate-400">BusTracker</span>
          </div>
          <div className="flex gap-4">
            <span onClick={() => router.push('/admin/login')} className="cursor-pointer hover:text-blue-400 transition-colors">Admin Login</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}