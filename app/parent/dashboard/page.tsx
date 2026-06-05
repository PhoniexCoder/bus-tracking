"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Bus, Clock, LogOut, MapPin, Navigation, RefreshCw, Users, Bell, HelpCircle, Activity, ShieldAlert } from "lucide-react"
import { fetchBackendAPI } from "@/lib/backend-auth"
import { FirestoreService, type StudentProfile } from "@/lib/firestore"
import type { DirectionsResult } from "@/lib/google-maps"
import { GoogleMapsService } from "@/lib/google-maps"
import { GoogleMap } from "@/components/google-map"
import haversine from "haversine-distance"

interface ParentLocation {
  latitude: number
  longitude: number
  accuracy: number
}

interface ParentBusStatus {
  nm: string
  mlat: number
  mlng: number
  dt: string
  online: boolean
  s1?: string
}

export default function ParentDashboard() {
  const { user, loading: authLoading, userRole, logout } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [busStatus, setBusStatus] = useState<ParentBusStatus | null>(null)
  const [busData, setBusData] = useState<any>(null)
  const [parentLocation, setParentLocation] = useState<ParentLocation | null>(null)
  const [directions, setDirections] = useState<DirectionsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [showRoutePath, setShowRoutePath] = useState(true)
  const [stops, setStops] = useState<any[]>([])
  const [availableBuses, setAvailableBuses] = useState<any[]>([])
  const uniqueAvailableBuses = useMemo(() => {
    const seen = new Set<string>()
    return availableBuses.filter((bus) => {
      if (seen.has(bus.busId)) return false
      seen.add(bus.busId)
      return true
    })
  }, [availableBuses])
  const [busPickerOpen, setBusPickerOpen] = useState(false)
  const [assigningBus, setAssigningBus] = useState(false)
  const busDataRef = useRef(busData)
  useEffect(() => {
    busDataRef.current = busData
  }, [busData])

  // Get parent's current location
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setParentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (err) => {
        console.error(`Error getting location: Code ${err.code} - ${err.message}`)
        let friendlyMessage = "Unable to get your location. "
        if (err.code === 1) {
          friendlyMessage += "Please enable location permissions in your browser settings."
        } else if (err.code === 2) {
          friendlyMessage += "Location information is currently unavailable."
        }
        setError(friendlyMessage)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  // Fetch stops from Firestore
  const loadRouteStops = useCallback(async (busId: string) => {
    if (!user) return
    try {
      const firestoreService = new FirestoreService(user.sub)
      const assignments = await firestoreService.getAllBusAssignments()
      const assignment = assignments.find((a) => a.busId === busId)
      if (assignment?.routeId) {
        const routeDoc = await firestoreService.getRouteById(assignment.routeId)
        if (routeDoc?.stops) {
          setStops(routeDoc.stops.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)))
        }
      }
    } catch (err) {
      console.error("Error loading route stops:", err)
    }
  }, [user])

  // Fetch bus status
  const fetchBusStatus = useCallback(async () => {
    if (!profile?.assignedBusId) return

    try {
      if (user) {
        const firestoreService = new FirestoreService(user.sub)
        const allBuses = await firestoreService.getAllBuses()
        const firebaseBus = allBuses.find((b) => b.busId === profile.assignedBusId)
        if (firebaseBus) {
          setBusData(firebaseBus)
        }
      }

      const response = await fetchBackendAPI(`/liveplate?device_id=${encodeURIComponent(profile.assignedBusId)}`)
      const data = await response.json()

      if (!response.ok) {
        setBusStatus(null)
        if (response.status === 404 && data?.error?.includes("unknown device_id")) {
          setError(`Bus device "${profile.assignedBusId}" is not registered on the fleet server. Select a different bus or ask an admin to add it.`)
        } else {
          throw new Error(data?.error || "Failed to fetch bus status")
        }
        return
      }

      const gps = data?.gps || {}
      const status: ParentBusStatus = {
        nm: data?.plate_number || data?.device_name || profile.assignedBusId,
        mlat: Number(gps?.latitude || 0),
        mlng: Number(gps?.longitude || 0),
        dt: gps?.last_update ? new Date(gps.last_update * 1000).toISOString() : new Date().toISOString(),
        online: !!gps?.online,
        s1: data?.s1 || "",
      }
      setBusStatus(status)
      setLastUpdate(new Date())
      loadRouteStops(profile.assignedBusId)
    } catch (err) {
      console.error("Error fetching bus status:", err)
      setBusStatus(null)
      setError("Unable to connect to fleet server. It may be offline.")
    }
  }, [profile?.assignedBusId, user, loadRouteStops])

  const loadAvailableBuses = useCallback(async () => {
    if (!user) return
    try {
      const firestoreService = new FirestoreService(user.sub)
      const buses = await firestoreService.getAllBuses()
      setAvailableBuses(buses)
    } catch (err) {
      console.error("Error loading available buses:", err)
    }
  }, [user])

  const handleParentAssignBus = async (busId: string) => {
    if (!user || !profile?.studentId) return
    setAssigningBus(true)
    try {
      const firestoreService = new FirestoreService(user.sub)
      await firestoreService.updateStudentProfile({ assignedBusId: busId })
      setProfile((prev) => prev ? { ...prev, assignedBusId: busId } : null)
      setBusPickerOpen(false)
    } catch (err: any) {
      console.error("Error assigning bus:", err)
      setError("Failed to assign bus: " + err.message)
    } finally {
      setAssigningBus(false)
    }
  }

  // Calculate distance and ETA
  const calculateDirections = useCallback(async () => {
    if (!busStatus || !parentLocation) return

    try {
      const maps = new GoogleMapsService()
      const data = await maps.calculateDistanceAndETA(
        { lat: busStatus.mlat, lng: busStatus.mlng },
        { lat: parentLocation.latitude, lng: parentLocation.longitude }
      )
      setDirections(data)
    } catch (err) {
      console.error("Error calculating directions:", err)
    }
  }, [busStatus, parentLocation])

  const calculateDirectionsKey = useMemo(() => {
    if (!busStatus || !parentLocation) return null
    return `${busStatus.mlat},${busStatus.mlng}-${parentLocation.latitude},${parentLocation.longitude}`
  }, [busStatus, parentLocation])

  // Load student profile
  useEffect(() => {
    if (authLoading) return

    if (!user || (userRole !== "student" && userRole !== "parent")) {
      router.push("/")
      return
    }

    const loadProfile = async () => {
      try {
        const firestoreService = new FirestoreService(user.sub)
        const studentProfile = await firestoreService.getStudentProfile()
        if (studentProfile) {
          setProfile(studentProfile)
        }
      } catch (err) {
        console.error("Error loading profile:", err)
        setError("Unable to load profile")
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
    getCurrentLocation()
  }, [user, userRole, authLoading, router, getCurrentLocation])

  // Fetch bus status when profile loads with assigned bus
  useEffect(() => {
    if (profile?.assignedBusId) {
      fetchBusStatus()
    }
  }, [profile?.assignedBusId, fetchBusStatus])

  // Poll for bus status every 30s until connected
  useEffect(() => {
    if (!profile?.assignedBusId || busStatus) return
    const interval = setInterval(fetchBusStatus, 30000)
    return () => clearInterval(interval)
  }, [profile?.assignedBusId, busStatus, fetchBusStatus])

  // Calculate directions when bus or student location changes
  useEffect(() => {
    if (!calculateDirectionsKey) return
    calculateDirections()
  }, [calculateDirectionsKey, calculateDirections])

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!profile?.assignedBusId) return

    let ws: WebSocket | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null

    const connectWebSocket = () => {
      try {
        const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:8000"
        ws = new WebSocket(`${wsUrl}/ws/live`)

        ws.onopen = () => {
          console.log("✅ WebSocket connected")
          setWsConnected(true)
          setError("")
        }

        ws.onmessage = async (event) => {
          try {
            const liveData = JSON.parse(event.data)
            const busDevice = liveData.find((item: any) => item.device_id === profile.assignedBusId)
            
            if (busDevice) {
              const currentBusData = busDataRef.current
              if (!currentBusData && user) {
                const firestoreService = new FirestoreService(user.sub)
                const allBuses = await firestoreService.getAllBuses()
                const firebaseBus = allBuses.find((b) => b.busId === profile.assignedBusId)
                if (firebaseBus) {
                  setBusData(firebaseBus)
                }
              }

              const gps = busDevice.gps || {}
              const status: ParentBusStatus = {
                nm: busDevice.plate_number || busDevice.device_name || profile.assignedBusId,
                mlat: Number(gps.latitude || 0),
                mlng: Number(gps.longitude || 0),
                dt: gps.last_update ? new Date(gps.last_update * 1000).toISOString() : new Date().toISOString(),
                online: !!gps.online,
                s1: busDevice.s1 || "",
              }
              setBusStatus(status)
              setLastUpdate(new Date())
            }
          } catch (err) {
            console.error("Error parsing WebSocket message:", err)
          }
        }

        ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error)
          setWsConnected(false)
        }

        ws.onclose = () => {
          setWsConnected(false)
          fetchBusStatus()
          reconnectTimeout = setTimeout(() => {
            connectWebSocket()
          }, 5000)
        }
      } catch (err) {
        console.error("Failed to connect WebSocket:", err)
        setError("Unable to establish real-time connection")
        fetchBusStatus()
        reconnectTimeout = setTimeout(connectWebSocket, 5000)
      }
    }

    connectWebSocket()

    return () => {
      if (ws) {
        ws.onopen = null
        ws.onmessage = null
        ws.onerror = null
        ws.onclose = null
        ws.close()
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [profile?.assignedBusId, user, fetchBusStatus])

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  const handleRefresh = () => {
    getCurrentLocation()
    fetchBusStatus()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0B] text-white">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-[#5e5ce6]/20 animate-pulse"></div>
          <div className="absolute inset-0 rounded-full border-4 border-t-[#5e5ce6] animate-spin"></div>
        </div>
        <p className="mt-6 text-xs font-bold tracking-widest text-[#c7c4d7]/80 uppercase animate-pulse">
          Loading Control Deck...
        </p>
      </div>
    )
  }

  const passengerCount = busStatus?.s1 ? parseInt(busStatus.s1, 10) : 0
  const nextStop = stops.length > 0 ? stops[0] : null
  const progressPercent = busStatus && nextStop
    ? Math.max(10, Math.min(90, 100 - Math.round((haversine({ lat: busStatus.mlat, lng: busStatus.mlng }, { lat: nextStop.latitude, lng: nextStop.longitude }) / 1000) * 10)))
    : 50

  return (
    <div className="min-h-screen bg-[#111317] text-[#e2e2e7] font-sans selection:bg-[#5e5ce6]/30 selection:text-white relative overflow-hidden flex flex-col h-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
        }
        .active-glow {
          box-shadow: 0 0 20px rgba(94, 92, 230, 0.3);
        }
        .pulse-indicator {
          position: relative;
        }
        .pulse-indicator::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          background: inherit;
          border-radius: inherit;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      ` }} />

      {/* TOP NAVIGATION BAR */}
      <header className="fixed top-0 w-full bg-[#111317]/60 backdrop-blur-xl border-b border-[#333539]/20 shadow-sm flex justify-between items-center px-6 py-2 h-16 z-50 transition-all duration-300 ease-in-out">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-[#c2c1ff]">OmniBus Tracking</span>
          <span className="text-[10px] uppercase bg-[#5e5ce6]/20 text-[#c2c1ff] border border-[#5e5ce6]/30 px-2 py-0.5 rounded-full font-bold">Parent</span>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400 pulse-indicator' : 'bg-red-500'}`}></div>
            <span className="text-[#c7c4d7] font-medium">{wsConnected ? 'Live Connection' : 'Connecting...'}</span>
          </div>
          <button 
            onClick={handleRefresh}
            className="p-2 rounded-full hover:bg-[#5e5ce6]/10 text-[#c7c4d7] hover:text-[#e2e2e7] transition-all"
            title="Refresh logs & coordinates"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button className="p-2 rounded-full hover:bg-[#5e5ce6]/10 text-[#c7c4d7] hover:text-[#e2e2e7] transition-all">
            <Bell className="h-4 w-4" />
          </button>
          <button className="p-2 rounded-full hover:bg-[#5e5ce6]/10 text-[#c7c4d7] hover:text-[#e2e2e7] transition-all">
            <HelpCircle className="h-4 w-4" />
          </button>
          <div className="h-8 w-8 rounded-full overflow-hidden border border-[#5e5ce6]/20 bg-[#5e5ce6]/10 flex items-center justify-center font-bold text-xs text-[#c2c1ff]">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : "P"}
          </div>
        </div>
      </header>

      {/* SIDE NAVIGATION (Desktop Only) */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-[#1a1c1f]/80 backdrop-blur-2xl border-r border-[#333539]/20 shadow-xl p-4 z-40 pt-20">
        <div className="mb-8 px-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#5e5ce6] flex items-center justify-center">
              <Bus className="h-4 w-4 text-white" />
            </div>
            <span className="text-[#c2c1ff] font-bold truncate">OmniBus Command</span>
          </div>
          <p className="text-[10px] font-semibold text-[#c7c4d7] uppercase tracking-wider pl-1">{profile?.name || "Active Session"}</p>
        </div>

        <nav className="flex-1 space-y-1">
          <a className="flex items-center gap-3 px-4 py-3 text-[#c7c4d7] hover:bg-white/5 hover:text-[#e2e2e7] rounded-xl transition-all" href="#">
            <Activity className="h-4 w-4" />
            Dashboard
          </a>
          <a className="flex items-center gap-3 px-4 py-3 bg-[#5e5ce6] text-white rounded-xl active-glow transition-all" href="#">
            <MapPin className="h-4 w-4" />
            Live Map View
          </a>
        </nav>

        <div className="mt-auto space-y-3">
          <button 
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-white/5 hover:bg-red-500/10 text-red-400 hover:text-red-300 border border-white/10 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CANVAS (Interactive Map) */}
      <main className="flex-1 w-full md:pl-64 pt-16 relative overflow-hidden h-full">
        {/* Inner container to constrain absolute layout elements within the visible content area */}
        <div className="relative w-full h-full">
          {/* Error banner */}
          {error && (
            <div className="absolute top-4 left-4 right-4 z-30 mx-auto max-w-xl">
              <Alert variant="destructive" className="bg-red-950/80 border-red-500/30 text-red-400 rounded-xl backdrop-blur">
                <AlertDescription className="font-semibold text-center text-xs flex items-center justify-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  {error}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Map Background */}
          <div className="absolute inset-0 z-0 h-full w-full">
            {profile?.assignedBusId && busStatus ? (
              <GoogleMap
                markers={[
                  // Bus marker
                  {
                    lat: busStatus.mlat,
                    lng: busStatus.mlng,
                    label: busData?.plateNumber || busStatus.nm,
                    status: busStatus.online ? 'online' : 'offline',
                    type: 'bus',
                  },
                  // User/Parent marker
                  ...(parentLocation ? [{
                    lat: parentLocation.latitude,
                    lng: parentLocation.longitude,
                    label: 'Parent Location',
                    type: 'user',
                  }] : []),
                  // Route stops markers
                  ...stops.map((stop, i) => ({
                    lat: stop.latitude,
                    lng: stop.longitude,
                    label: `${i + 1}`,
                    type: 'stop',
                    status: 'notpassed',
                  })),
                  // Route polyline
                  ...(showRoutePath && directions?.polyline && parentLocation ? [{
                    lat: 0,
                    lng: 0,
                    type: 'polyline',
                    path: directions.polyline,
                  }] : [])
                ]}
                center={busStatus ? { lat: busStatus.mlat, lng: busStatus.mlng } : undefined}
                height="100%"
                width="100%"
                showTrafficLayer={true}
              />
            ) : (
              <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-[#111317]">
                {!profile?.assignedBusId && !loading ? (
                  <div className="glass-card p-8 text-center rounded-[32px] max-w-md mx-6 shadow-2xl backdrop-blur">
                    <div className="bg-yellow-500/10 border border-yellow-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Bus className="h-8 w-8 text-yellow-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No Bus Assigned</h3>
                    <p className="text-[#c7c4d7]/80 leading-relaxed text-sm mb-6">
                      Select a bus to start tracking its real-time location.
                    </p>
                    {busPickerOpen ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {uniqueAvailableBuses.length === 0 ? (
                          <p className="text-xs text-[#c7c4d7]/50">No buses available. Please contact your coordinator.</p>
                        ) : (
                          uniqueAvailableBuses.map((bus) => (
                            <button
                              key={bus.busId}
                              onClick={() => handleParentAssignBus(bus.busId)}
                              disabled={assigningBus}
                              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-[#5e5ce6]/20 border border-white/10 hover:border-[#5e5ce6]/30 transition-all text-left disabled:opacity-50"
                            >
                              <div>
                                <p className="text-sm font-semibold text-white">{bus.busId}</p>
                                {bus.plateNumber && bus.plateNumber !== bus.busId && (
                                  <p className="text-[10px] text-[#c7c4d7]/60">{bus.plateNumber}</p>
                                )}
                              </div>
                              <Bus className="h-4 w-4 text-[#5e5ce6]" />
                            </button>
                          ))
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => { loadAvailableBuses(); setBusPickerOpen(true) }}
                        className="px-6 py-3 rounded-xl bg-[#5e5ce6] text-white font-semibold text-sm hover:brightness-110 transition-all active:scale-95"
                      >
                        Select Your Bus
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="glass-card p-8 text-center rounded-[32px] max-w-md mx-6 shadow-2xl backdrop-blur flex flex-col items-center justify-center">
                    <div className="bg-[#5e5ce6]/10 border border-[#5e5ce6]/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                      <MapPin className="h-8 w-8 text-[#5e5ce6]" />
                    </div>
                    <p className="text-sm font-bold text-white uppercase tracking-wider mb-2">Establishing Connection</p>
                    <p className="text-xs text-[#c7c4d7]/60 mb-6 leading-relaxed">
                      Waiting for vehicle telemetry signals for bus <span className="font-mono text-[#c2c1ff]">{profile?.assignedBusId}</span>...
                    </p>
                    
                    <div className="pt-4 border-t border-white/5 w-full">
                      {busPickerOpen ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {uniqueAvailableBuses.length === 0 ? (
                            <p className="text-xs text-[#c7c4d7]/50">No buses available. Please contact your coordinator.</p>
                          ) : (
                            uniqueAvailableBuses.map((bus) => (
                              <button
                                key={bus.busId}
                                onClick={() => handleParentAssignBus(bus.busId)}
                                disabled={assigningBus}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-[#5e5ce6]/20 border border-white/10 hover:border-[#5e5ce6]/30 transition-all text-left disabled:opacity-50"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-white">{bus.busId}</p>
                                  {bus.plateNumber && bus.plateNumber !== bus.busId && (
                                    <p className="text-[10px] text-[#c7c4d7]/60">{bus.plateNumber}</p>
                                  )}
                                </div>
                                <Bus className="h-4 w-4 text-[#5e5ce6]" />
                              </button>
                            ))
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => { loadAvailableBuses(); setBusPickerOpen(true) }}
                          className="px-6 py-2.5 rounded-xl bg-[#5e5ce6] text-white font-semibold text-xs hover:brightness-110 transition-all active:scale-95"
                        >
                          Change Assigned Bus
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FLOATING CONTROL PANEL */}
          {profile?.assignedBusId && busStatus && (
            <div className="absolute left-4 top-4 bottom-24 md:bottom-4 w-[calc(100%-32px)] md:w-80 z-20 pointer-events-none flex flex-col gap-4 max-h-[calc(100%-110px)] overflow-y-auto pr-1">
              <div className="glass-card rounded-2xl p-4 pointer-events-auto flex flex-col gap-4 backdrop-blur">
                {/* STATUS HEADER */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${busStatus.online ? 'bg-green-400 pulse-indicator' : 'bg-gray-500'}`}></span>
                    <span className="font-semibold text-white text-sm">
                      {busData?.plateNumber || busStatus.nm} - {busStatus.online ? 'Active' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] bg-white/5 px-2 py-1 rounded-lg text-[#c7c4d7] border border-white/5 font-mono">
                      {profile.assignedBusId}
                    </span>
                    <button
                      onClick={() => { loadAvailableBuses(); setBusPickerOpen(!busPickerOpen) }}
                      className="text-[10px] px-2 py-1 rounded-lg text-[#c7c4d7]/50 hover:text-[#c2c1ff] hover:bg-[#5e5ce6]/10 transition-all"
                      title="Change bus"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* ETA CARD */}
                <div className="bg-[#5e5ce6]/95 rounded-xl p-4 shadow-lg flex flex-col items-center text-center text-white">
                  <span className="text-[10px] text-white/75 uppercase tracking-widest mb-1">Estimated Arrival</span>
                  <span className="text-2xl font-bold mb-2">{directions?.duration || "Calculating..."}</span>
                  {directions?.distance && (
                    <div className="flex items-center gap-1.5 text-white/90 text-xs">
                      <Navigation className="h-3.5 w-3.5" />
                      <span>{directions.distance} away</span>
                    </div>
                  )}
                </div>

                {/* STATS BENTO */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 rounded-xl p-3 flex flex-col gap-1 border border-white/5">
                    <Users className="h-4 w-4 text-[#5e5ce6]" />
                    <span className="text-[10px] text-[#c7c4d7]">Passengers</span>
                    <span className="text-sm font-semibold text-white">{passengerCount > 0 ? `${passengerCount} Onboard` : '0 Onboard'}</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 flex flex-col gap-1 border border-white/5">
                    <Activity className="h-4 w-4 text-[#5e5ce6]" />
                    <span className="text-[10px] text-[#c7c4d7]">Status</span>
                    <span className="text-sm font-semibold text-white">{busStatus.online ? "Transit" : "Parked"}</span>
                  </div>
                </div>

                {/* NEXT STOP */}
                <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-[#5e5ce6]" />
                    <span className="text-xs font-semibold text-white">Next Target Stop</span>
                  </div>
                  <p className="text-xs text-[#c7c4d7] truncate">{nextStop?.name || "Depot Gateway"}</p>
                  <div className="mt-3 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#5e5ce6] shadow-[0_0_10px_rgba(94,92,230,0.5)] transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>

                {/* ROUTE TOGGLE */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-[#c7c4d7]" />
                    <span className="text-xs text-white">Show Optimal Path</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={showRoutePath}
                      onChange={(e) => setShowRoutePath(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-[#333539] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5e5ce6] active-glow"></div>
                  </label>
                </div>

                {busPickerOpen && (
                  <div className="rounded-xl bg-[#1a1c1f] border border-white/10 p-3 space-y-1.5">
                    <p className="text-[10px] text-[#c7c4d7]/60 uppercase tracking-wider font-semibold mb-2">Select a different bus</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {uniqueAvailableBuses.map((bus) => (
                        <button
                          key={bus.busId}
                          onClick={() => handleParentAssignBus(bus.busId)}
                          disabled={assigningBus || bus.busId === profile?.assignedBusId}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all text-left ${
                            bus.busId === profile?.assignedBusId
                              ? 'bg-[#5e5ce6]/20 text-[#c2c1ff] border border-[#5e5ce6]/30'
                              : 'bg-white/5 hover:bg-[#5e5ce6]/10 text-white border border-white/5 hover:border-[#5e5ce6]/20'
                          } disabled:opacity-50`}
                        >
                          <span className="font-mono">{bus.busId}</span>
                          {bus.busId === profile?.assignedBusId && <span className="text-[9px]">Active</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleRefresh}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold border border-white/5 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Trigger Telemetry Update
                </button>
              </div>
            </div>
          )}

          {/* RECENT ALERTS (Floating Right - Desktop Only) */}
          {profile?.assignedBusId && busStatus && (
            <div className="absolute right-4 bottom-4 z-20 hidden lg:block w-72 pointer-events-none">
              <div className="glass-card rounded-2xl p-4 pointer-events-auto backdrop-blur">
                <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-1">
                  <span className="font-semibold text-white text-xs">Command Alerts</span>
                  <Clock className="h-4 w-4 text-[#5e5ce6]" />
                </div>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="w-1 bg-[#5e5ce6] rounded-full"></div>
                    <div>
                      <p className="text-xs text-white">WebSocket connection online</p>
                      <p className="text-[9px] text-[#c7c4d7] uppercase font-mono">Real-time Telemetry</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-1 bg-green-500 rounded-full"></div>
                    <div>
                      <p className="text-xs text-white">Bus location synchronized</p>
                      <p className="text-[9px] text-[#c7c4d7] uppercase font-mono">{lastUpdate ? lastUpdate.toLocaleTimeString() : "Synchronized"}</p>
                    </div>
                  </div>
                  {busStatus.online && (
                    <div className="flex gap-2">
                      <div className="w-1 bg-[#5e5ce6] rounded-full"></div>
                      <div>
                        <p className="text-xs text-white">Transmitting coordinates</p>
                        <p className="text-[9px] text-[#c7c4d7] uppercase font-mono">{busStatus.mlat.toFixed(4)}, {busStatus.mlng.toFixed(4)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* BOTTOM NAVIGATION (Mobile Only) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-16 px-4 pb-safe md:hidden bg-[#1e2023]/70 backdrop-blur-lg border-t border-[#333539]/15 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] rounded-t-xl">
        <a className="flex flex-col items-center justify-center bg-[#5e5ce6]/20 text-[#c2c1ff] rounded-full px-4 py-1 transition-transform scale-95" href="#">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
          <span className="text-[10px] font-medium">Live Map</span>
        </a>
        <button 
          onClick={handleRefresh}
          className="flex flex-col items-center justify-center text-[#c7c4d7] hover:text-[#5e5ce6] transition-transform scale-95"
        >
          <span className="material-symbols-outlined">sync</span>
          <span className="text-[10px] font-medium">Refresh</span>
        </button>
        <button 
          onClick={handleLogout}
          className="flex flex-col items-center justify-center text-red-400 hover:text-red-300 transition-transform scale-95"
        >
          <span className="material-symbols-outlined">logout</span>
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </nav>
    </div>
  )
}
