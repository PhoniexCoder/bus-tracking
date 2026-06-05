"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Video, VideoOff, RefreshCw, LogOut, ArrowLeft, Camera, Maximize2,
  VolumeX, ShieldCheck, Radio, Play, Square, AlertTriangle
} from "lucide-react"

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8000").replace(/\/+$/, "")

interface DeviceEntry {
  device_id: string
  device_name: string
  plate_number: string
  gps: {
    online: boolean
    latitude: number
    longitude: number
    speed_kmh: number
    plate_number: string
  }
}

export default function CameraFeedPage() {
  const { user, userRole, logout } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [devices, setDevices] = useState<DeviceEntry[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("")
  const [isLive, setIsLive] = useState(true)
  const [currentTime, setCurrentTime] = useState("")
  const [feedErrors, setFeedErrors] = useState<Record<string, boolean>>({})
  const [isPageVisible, setIsPageVisible] = useState(true)

  useEffect(() => {
    const handler = () => setIsPageVisible(!document.hidden)
    document.addEventListener("visibilitychange", handler)
    return () => document.removeEventListener("visibilitychange", handler)
  }, [])

  useEffect(() => {
    if (isPageVisible && !loading) {
      setFeedErrors({})
    }
  }, [isPageVisible, loading])

  const erroredCount = Object.keys(feedErrors).length
  useEffect(() => {
    if (erroredCount === 0) return
    const timer = setInterval(() => setFeedErrors({}), 15000)
    return () => clearInterval(timer)
  }, [erroredCount])

  useEffect(() => {
    if (!user || userRole !== "admin") {
      router.push("/")
      return
    }

    const fetchDevices = async () => {
      try {
        const res = await fetch("/api/fleet/api/liveplate_all")
        if (res.ok) {
          const data: DeviceEntry[] = await res.json()
          setDevices(data)
          if (data.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(data[0].device_id)
          }
        }
      } catch (err) {
        console.error("Failed to load devices:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchDevices()
    const interval = setInterval(fetchDevices, 30000)
    return () => clearInterval(interval)
  }, [user, userRole, router, selectedDeviceId])

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleString('en-IN', { hour12: false }))
    }
    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [])

  const selectedDevice = devices.find(d => d.device_id === selectedDeviceId)

  const getFeedUrl = useCallback((channel: number) => {
    if (!selectedDeviceId) return ""
    return `${BACKEND_URL}/api/video_feed/${selectedDeviceId}/${channel}`
  }, [selectedDeviceId])

  const handleFeedError = useCallback((channel: number) => {
    setFeedErrors(prev => ({ ...prev, [`cam-${channel}`]: true }))
  }, [])

  const handleRefresh = useCallback(() => {
    setFeedErrors({})
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#010f1f] text-white">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-[#5e5ce6]/20 animate-pulse" />
          <div className="absolute inset-0 rounded-full border-4 border-t-[#5e5ce6] animate-spin" />
        </div>
        <p className="mt-6 text-xs font-bold tracking-widest text-[#a3b8cc]/80 uppercase animate-pulse">
          Initializing Video Feeds...
        </p>
      </div>
    )
  }

  const feeds = [
    { id: "cam-0", name: "01 - FRONT ENTRYWAY", location: "Entrance & Stairs", channel: 0 },
    { id: "cam-1", name: "02 - DRIVER DECK", location: "Controls & Front Cabin", channel: 1 },
    { id: "cam-2", name: "03 - PASSENGER CABIN", location: "Mid-section Seating", channel: 2 },
    { id: "cam-3", name: "04 - ROAD VIEW", location: "Forward Road View", channel: 3 },
  ]

  const selectedPlate = selectedDevice?.gps?.plate_number || selectedDevice?.plate_number || selectedDeviceId
  const isOnline = selectedDevice?.gps?.online || false
  const showFeeds = isLive && isOnline && isPageVisible

  return (
    <div className="min-h-screen bg-[#010f1f] text-[#d4e4fb] font-sans selection:bg-[#5e5ce6]/30 selection:text-white relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-[#5e5ce6]/10 to-transparent blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-[#0a84ff]/10 to-transparent blur-[120px]" />
      </div>

      <header className="relative z-10 glass-panel border-b border-white/5 shadow-2xl backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-[#5e5ce6] to-[#0a84ff] p-3 rounded-xl shadow-lg shadow-[#5e5ce6]/25">
                <Camera className="h-6 w-6 text-white animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-[#d4e4fb] to-[#a3b8cc] bg-clip-text text-transparent">
                  CCTV Telemetry Deck
                </h1>
                <p className="text-xs text-[#a3b8cc]/60 font-semibold tracking-wider uppercase mt-0.5">Live Bus Surveillance Gate</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push('/admin/dashboard')} className="border-white/10 hover:bg-white/5 text-[#a3b8cc] hover:text-white rounded-xl h-9">
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <Button variant="outline" size="sm" onClick={async () => { await logout(); router.push("/") }} className="border-red-500/20 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-xl h-9">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="glass-panel border-white/5 rounded-2xl p-4 mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[#a3b8cc]/60">Select Vehicle:</label>
            <select
              className="bg-[#0d1c2d] border border-white/10 text-white rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#5e5ce6] focus:border-[#5e5ce6] transition-all font-semibold outline-none"
              value={selectedDeviceId}
              onChange={(e) => { setSelectedDeviceId(e.target.value); setFeedErrors({}) }}
            >
              {devices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.gps?.plate_number || d.plate_number || d.device_id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 text-xs font-semibold text-[#a3b8cc]/80">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-[#0a84ff] animate-pulse" />
                <span>Vehicle: <strong className="text-white">{selectedPlate}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-4 w-4 ${isOnline ? 'text-green-400' : 'text-red-400'}`} />
                <span>Status: <strong className={isOnline ? 'text-green-400' : 'text-red-400'}>{isOnline ? 'Online' : 'Offline'}</strong></span>
              </div>
            </div>

            <div className="h-4 w-px bg-white/10 hidden md:block" />

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} className="rounded-xl border border-white/10 text-xs font-semibold bg-white/5 text-[#a3b8cc] hover:text-white">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsLive(!isLive)} className={`rounded-xl border border-white/10 text-xs font-semibold ${isLive ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/5 text-[#a3b8cc]'}`}>
                {isLive ? <Square className="h-3 w-3 mr-1.5 fill-red-400" /> : <Play className="h-3 w-3 mr-1.5" />}
                {isLive ? 'STOP' : 'START'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {feeds.map((feed) => {
            const hasError = feedErrors[feed.id]
            return (
              <Card key={feed.id} className="glass-panel border-white/5 rounded-2xl overflow-hidden hover:border-[#5e5ce6]/30 transition-all duration-300 shadow-2xl group relative">
                <CardHeader className="bg-white/5 border-b border-white/5 py-3.5 px-5 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-white uppercase tracking-wider">{feed.name}</CardTitle>
                    <p className="text-[10px] text-[#a3b8cc]/50 font-semibold uppercase mt-0.5">{feed.location}</p>
                  </div>
                  <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    showFeeds && !hasError
                      ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                      : 'bg-white/5 border border-white/10 text-[#a3b8cc]/50'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${showFeeds && !hasError ? 'bg-red-500 animate-pulse' : 'bg-white/30'}`} />
                    {showFeeds && !hasError ? 'LIVE' : 'OFF'}
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div
                    className="aspect-video bg-[#010811] relative flex items-center justify-center overflow-hidden"
                    style={{
                      backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)',
                      backgroundSize: '100% 4px'
                    }}
                  >
                    <div className="absolute inset-0 border border-white/5 pointer-events-none z-10" />

                    <div className="absolute top-4 left-4 z-10 text-[10px] font-mono text-green-400/80 drop-shadow-md space-y-0.5 select-none">
                      <p>{selectedPlate}</p>
                      <p>{feed.id.toUpperCase()}</p>
                    </div>
                    <div className="absolute top-4 right-4 z-10 text-[10px] font-mono text-green-400/80 drop-shadow-md select-none text-right">
                      <p>MJPEG</p>
                    </div>
                    <div className="absolute bottom-4 left-4 z-10 text-[10px] font-mono text-green-400/80 drop-shadow-md select-none">
                      <p>{currentTime || "00:00:00"}</p>
                    </div>

                    {showFeeds && !hasError ? (
                      <img
                        key={`${selectedDeviceId}-${feed.channel}-${Date.now()}`}
                        src={getFeedUrl(feed.channel)}
                        alt={`Camera ${feed.channel}`}
                        className="absolute inset-0 w-full h-full object-contain"
                        onError={() => handleFeedError(feed.channel)}
                      />
                    ) : hasError ? (
                      <div className="flex flex-col items-center justify-center space-y-3 z-20">
                        <AlertTriangle className="h-8 w-8 text-yellow-500/60" />
                        <p className="text-xs font-bold text-[#a3b8cc]/50 uppercase tracking-widest">Feed Unavailable</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="relative w-16 h-16 flex items-center justify-center">
                          <div className="absolute inset-0 rounded-full border border-green-500/20 animate-ping" />
                          <div className="absolute inset-2 rounded-full border border-green-500/40 animate-pulse" />
                          <Video className="h-6 w-6 text-green-400 z-10" />
                        </div>
                        <div className="text-center font-mono text-[10px] text-green-400/70 select-none">
                          <p className="animate-pulse">STANDBY</p>
                        </div>
                      </div>
                    )}

                    {showFeeds && !hasError && (
                      <div className="absolute left-0 right-0 h-0.5 bg-green-500/15 top-1/3 animate-bounce shadow-[0_0_10px_rgba(34,197,94,0.5)] z-10 pointer-events-none" />
                    )}
                  </div>

                  <div className="bg-white/5 px-4 py-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-8 px-2.5 text-[#a3b8cc] hover:bg-white/5 hover:text-white rounded-lg gap-1.5">
                        <Maximize2 className="h-3.5 w-3.5" />
                        Fullscreen
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2.5 text-[#a3b8cc] hover:bg-white/5 hover:text-white rounded-lg gap-1.5">
                        <VolumeX className="h-3.5 w-3.5" />
                        Audio Off
                      </Button>
                    </div>
                    <span className="text-[10px] font-mono text-[#a3b8cc]/40">{selectedDeviceId}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {!isOnline && devices.length > 0 && (
          <div className="mt-8 glass-panel border border-yellow-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Vehicle Offline</h4>
              <p className="text-xs text-[#a3b8cc]/80 mt-1 leading-relaxed">
                {selectedPlate} is currently offline. Camera feeds will be available once the vehicle connects to the network.
              </p>
            </div>
          </div>
        )}

        {!isPageVisible && (
          <div className="mt-4 glass-panel border border-blue-500/20 rounded-2xl p-4">
            <p className="text-xs text-center text-[#a3b8cc]/80">
              Feeds paused — page is hidden.
            </p>
          </div>
        )}
      </main>

      <footer className="relative z-10 glass-panel border-t border-white/5 mt-16 bg-[#051424]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid md:grid-cols-3 gap-8 text-xs sm:text-sm">
            <div className="space-y-2">
              <h3 className="font-bold text-white uppercase tracking-wider text-xs">About</h3>
              <p className="text-[#a3b8cc]/70 leading-relaxed">
                School Transport Tracking System - An intelligent initiative for student safety, real-time logistics monitoring, and parent convenience.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-white uppercase tracking-wider text-xs">Surveillance Support</h3>
              <p className="text-[#a3b8cc]/70">
                For administrative inquiries regarding CCTV storage logs:
                <br />
                <span className="text-[#0a84ff] font-medium font-mono">security@globalschool.edu</span>
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-white uppercase tracking-wider text-xs">Telemetry Security</h3>
              <p className="text-[#a3b8cc]/70">
                Deck Version 1.4.0
                <br />
                Security Gateway: <span className="text-green-400 font-semibold">Active</span>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
