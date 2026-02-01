"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Bus,
  Clock,
  MapPin,
  Navigation,
  RefreshCw,
  ArrowLeft,
  Wifi,
  WifiOff,
  Route,
  User,
  Compass,
  Phone,
  Mail,
  Info,
} from "lucide-react"
import { Timestamp } from "firebase/firestore"
import { fetchBackendAPI } from "@/lib/backend-auth"
import { FirestoreService, type StudentProfile } from "@/lib/firestore"
import type { DirectionsResult } from "@/lib/google-maps"
import { GoogleMapsService } from "@/lib/google-maps"
import { GoogleMap } from "@/components/google-map"
import haversine from 'haversine-distance'

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
  const { user } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [busStatus, setBusStatus] = useState<ParentBusStatus | null>(null)
  const [busData, setBusData] = useState<any>(null)
  const [parentLocation, setParentLocation] = useState<ParentLocation | null>(null)
  const [directions, setDirections] = useState<DirectionsResult | null>(null)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Track last route calculation to throttle API calls
  const lastCalcRef = useRef<{ lat: number; lng: number; time: number } | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

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
        console.warn(`High accuracy location failed (${err.message}), retrying with low accuracy...`)
        // Retry with low accuracy
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setParentLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            })
          },
          (retryErr) => {
            console.error(`Error getting location: Code ${retryErr.code} - ${retryErr.message}`)
            if (retryErr.code === 1) {
              setError("Please enable location permissions")
            }
          },
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 }
        )
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }, [])

  const fetchBusStatus = useCallback(async () => {
    if (!profile?.assignedBusId) return
    try {
      if (user) {
        const firestoreService = new FirestoreService(user.uid)
        const allBuses = await firestoreService.getAllBuses()
        const firebaseBus = allBuses.find((b) => b.busId === profile.assignedBusId)
        if (firebaseBus) setBusData(firebaseBus)
      }
      const response = await fetchBackendAPI(`/api/liveplate?device_id=${encodeURIComponent(profile.assignedBusId)}`)
      let data = await response.json()
      if (!response.ok) {
        const allRes = await fetchBackendAPI(`/api/liveplate_all`)
        const allData = await allRes.json()
        const match = Array.isArray(allData)
          ? allData.find(
            (item: any) =>
              item.device_id === profile.assignedBusId ||
              item.device_id === profile.assignedBusId ||
              item.plate_number === profile.assignedBusId ||
              (item.device_info && item.device_info.erpId === profile.assignedBusId) ||
              // Also check if erpId matches loosely (string/number)
              (item.device_info && String(item.device_info.erpId) === String(profile.assignedBusId)) ||
              // Fuzzy match digits: "BusNo.6" matches "6"
              (item.plate_number && String(item.plate_number).replace(/\D/g, '') === String(profile.assignedBusId).replace(/\D/g, ''))
          )
          : null
        if (!match) throw new Error(data?.error || "Failed to fetch bus status")
        data = match
      }
      const gps = data?.gps || {}
      const status: ParentBusStatus = {
        nm: data?.plate_number || data?.device_name || profile.assignedBusId,
        mlat: Number(gps?.latitude || 0),
        mlng: Number(gps?.longitude || 0),
        dt: gps?.last_update ? new Date(gps.last_update * 1000).toISOString() : new Date().toISOString(),
        online: !!gps?.online,
        s1: data?.s1,
      }
      setBusStatus(status)
      setLastUpdate(new Date())
    } catch (err) {
      console.error("Error fetching bus status:", err)
    }
  }, [profile?.assignedBusId, user])

  const calculateDirections = useCallback(async () => {
    if (!busStatus || !parentLocation) return

    // Throttling: Check distance and time
    const now = Date.now()
    const currentLoc = { lat: busStatus.mlat, lng: busStatus.mlng }

    // Initial calc or forced update conditions
    let shouldUpdate = false

    if (!lastCalcRef.current) {
      shouldUpdate = true
    } else {
      const dist = haversine(
        { lat: lastCalcRef.current.lat, lng: lastCalcRef.current.lng },
        { lat: currentLoc.lat, lng: currentLoc.lng }
      )
      // Update if moved > 50 meters OR > 45 seconds passed
      if (dist > 50 || (now - lastCalcRef.current.time > 45000)) {
        shouldUpdate = true
      }
    }

    if (!shouldUpdate) return

    try {
      const maps = new GoogleMapsService()
      const data = await maps.calculateDistanceAndETA(
        { lat: busStatus.mlat, lng: busStatus.mlng },
        { lat: parentLocation.latitude, lng: parentLocation.longitude }
      )
      setDirections(data)
      lastCalcRef.current = { ...currentLoc, time: now }
      console.log('🔄 Travel Info Updated (Live)')
    } catch (err) {
      console.error("Error calculating directions:", err)
    }
  }, [busStatus, parentLocation])

  useEffect(() => {
    // If we have URL params, we don't strictly need 'user'
    const loadProfile = async () => {
      try {
        const url = typeof window !== "undefined" ? new URL(window.location.href) : null
        const busId = url?.searchParams.get("busId")
        const studentName = url?.searchParams.get("studentName")

        if (busId) {
          setProfile({
            studentId: "external",
            username: "external",
            name: studentName ? decodeURIComponent(studentName) : "Student",
            assignedBusId: busId,
            createdAt: Timestamp.now(),
          })
          setLoading(false)
        } else if (user) {
          const firestoreService = new FirestoreService(user.uid)
          const studentProfile = await firestoreService.getStudentProfile()
          if (studentProfile) setProfile(studentProfile)
          setLoading(false)
        } else {
          // Guest mode / Public link
          setLoading(false)
        }
      } catch (err) {
        console.error("Error loading profile:", err)
        setError("Unable to load profile")
        setLoading(false)
      }
    }
    loadProfile()
    getCurrentLocation()
  }, [user, router, getCurrentLocation])

  useEffect(() => {
    calculateDirections()
  }, [calculateDirections])

  // Reverse geocode bus coordinates to a human-readable location name
  useEffect(() => {
    const fetchLocationName = async () => {
      if (!busStatus || isNaN(busStatus.mlat) || isNaN(busStatus.mlng)) return
      try {
        const maps = new GoogleMapsService()
        const address = await maps.reverseGeocode(busStatus.mlat, busStatus.mlng)
        setLocationName(address)
      } catch (err) {
        console.error("Error reverse geocoding:", err)
        setLocationName(null)
      }
    }
    fetchLocationName()
  }, [busStatus?.mlat, busStatus?.mlng])

  useEffect(() => {
    if (!profile?.assignedBusId) return
    let ws: WebSocket | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null
    let offlineTimer: NodeJS.Timeout | null = null

    const connectWebSocket = () => {
      try {
        const base = process.env.NEXT_PUBLIC_BACKEND_WS_URL || "http://localhost:8000"
        const wsUrl = base.startsWith("http")
          ? base.replace(/^http(s?):\/\//, (_, s) => (s ? "wss://" : "ws://"))
          : base
        ws = new WebSocket(`${wsUrl}/ws/live`)
        ws.onopen = () => {
          if (offlineTimer) clearTimeout(offlineTimer)
          setWsConnected(true)
          setError("")
        }
        ws.onmessage = async (event) => {
          try {
            const liveData = JSON.parse(event.data)
            const busDevice = liveData.find(
              (item: any) =>
                item.device_id === profile.assignedBusId ||
                item.plate_number === profile.assignedBusId ||
                (item.device_info && String(item.device_info.erpId) === String(profile.assignedBusId)) ||
                // Fuzzy match digits: "BusNo.6" matches "6"
                (item.plate_number && String(item.plate_number).replace(/\D/g, '') === String(profile.assignedBusId).replace(/\D/g, ''))
            )
            if (busDevice) {
              if (!busData && user) {
                const firestoreService = new FirestoreService(user.uid)
                const allBuses = await firestoreService.getAllBuses()
                const firebaseBus = allBuses.find((b) => b.busId === profile.assignedBusId)
                if (firebaseBus) setBusData(firebaseBus)
              }
              const gps = busDevice.gps || {}
              const status: ParentBusStatus = {
                nm: busDevice.plate_number || busDevice.device_name || profile.assignedBusId,
                mlat: Number(gps.latitude || 0),
                mlng: Number(gps.longitude || 0),
                dt: gps.last_update ? new Date(gps.last_update * 1000).toISOString() : new Date().toISOString(),
                online: !!gps.online,
                s1: busDevice.s1,
              }
              setBusStatus(status)
              setLastUpdate(new Date())
            }
          } catch (err) {
            console.error("Error parsing WebSocket message:", err)
          }
        }
        ws.onerror = () => {
          // Debounce offline indicator to avoid flicker during reconnects
          offlineTimer = setTimeout(() => setWsConnected(false), 3000)
        }
        ws.onclose = () => {
          // Debounce offline indicator to avoid flicker during reconnects
          offlineTimer = setTimeout(() => setWsConnected(false), 3000)
          fetchBusStatus()
          reconnectTimeout = setTimeout(connectWebSocket, 5000)
        }
      } catch (err) {
        console.error("Failed to connect WebSocket:", err)
        fetchBusStatus()
        reconnectTimeout = setTimeout(connectWebSocket, 5000)
      }
    }
    connectWebSocket()
    return () => {
      if (ws) ws.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (offlineTimer) clearTimeout(offlineTimer)
    }
  }, [profile?.assignedBusId, user, busData, fetchBusStatus])

  const handleRefresh = () => {
    getCurrentLocation()
    fetchBusStatus()
  }

  const passengerCount = busStatus?.s1 ? parseInt(busStatus.s1, 10) : null

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="flex flex-col items-center gap-2">
          <Bus className="h-10 w-10 text-blue-400 animate-bounce" />
          <p className="text-slate-300 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Compact Header */}
      <header className="relative z-10 border-b border-white/10 backdrop-blur-xl bg-slate-900/50 shrink-0">
        <div className="max-w-7xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className="text-slate-400 hover:text-white hover:bg-white/10 h-8 px-2"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                <span className="text-sm">Home</span>
              </Button>
              <div className="h-5 w-px bg-white/20" />
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-lg border border-blue-500/20">
                  <Bus className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-base font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                    Live Tracking
                  </h1>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-3 ml-4 text-sm text-slate-300">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3 text-blue-400" />
                  {profile?.name || "User"}
                </span>
                {profile?.assignedBusId && (
                  <span className="flex items-center gap-1">
                    <Bus className="h-3 w-3 text-cyan-400" />
                    <span className="font-mono">{profile.assignedBusId}</span>
                  </span>
                )}
                {lastUpdate && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {lastUpdate.toLocaleTimeString("en-IN")}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {(() => {
                const isLive = wsConnected || (!!lastUpdate && Date.now() - lastUpdate.getTime() < 15000)
                return (
                  <Badge
                    className={`text-xs h-6 ${isLive
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"
                      }`}
                  >
                    {isLive ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                    {isLive ? "Live" : "Offline"}
                  </Badge>
                )
              })()}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                className="text-slate-400 hover:text-white hover:bg-white/10 h-7 w-7 p-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Flex Grow */}
      <main className="relative z-10 flex-1 overflow-hidden">
        <div className="h-full max-w-7xl mx-auto px-3 py-3">
          {error && (
            <div className="mb-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!profile?.assignedBusId && !loading ? (
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-orange-500/20">
                  <Bus className="h-7 w-7 text-orange-400" />
                </div>
                <h3 className="text-lg font-bold mb-1">No Bus Assigned</h3>
                <p className="text-slate-300 text-sm mb-4">
                  Please enter a bus number on the homepage to start tracking.
                </p>
                <Button
                  onClick={() => router.push("/")}
                  size="sm"
                  className="bg-gradient-to-r from-blue-500 to-cyan-500"
                >
                  Go to Homepage
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid lg:grid-cols-12 gap-3 h-full">
              {/* Left Column - Compact Cards */}
              <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-2 overflow-y-auto">
                {/* Vehicle + Status Combined */}
                {busStatus && (
                  <Card className="bg-white/5 border-white/10 backdrop-blur-sm shrink-0">
                    <div className="p-3 border-b border-white/5 bg-gradient-to-r from-blue-500/10 to-transparent">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bus className="h-5 w-5 text-blue-400" />
                          <span className="text-sm font-semibold text-white">Vehicle</span>
                        </div>
                        <Badge
                          className={`text-xs h-5 ${busStatus.online
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                            }`}
                        >
                          {busStatus.online ? "● Active" : "● Offline"}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <div>
                        <p className="text-lg font-bold text-white">{busData?.plateNumber || busStatus.nm}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400">Model:</span>
                          <span className="text-white ml-1">{busData?.model || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Capacity:</span>
                          <span className="text-white ml-1">{busData?.capacity || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Updated:</span>
                          <span className="text-white ml-1">{new Date(busStatus.dt).toLocaleTimeString("en-IN")}</span>
                        </div>
                        {passengerCount !== null && !isNaN(passengerCount) && (
                          <div>
                            <span className="text-slate-400">Passengers:</span>
                            <span className="text-white ml-1">{passengerCount}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Distance & ETA Combined */}
                {directions && (
                  <Card className="bg-white/5 border-white/10 backdrop-blur-sm shrink-0">
                    <div className="p-3 border-b border-white/5 bg-gradient-to-r from-purple-500/10 to-transparent">
                      <div className="flex items-center gap-2">
                        <Navigation className="h-5 w-5 text-purple-400" />
                        <span className="text-sm font-semibold text-white">Travel Info</span>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                          <div className="flex items-center gap-1 mb-1">
                            <Route className="h-3.5 w-3.5 text-blue-400" />
                            <span className="text-xs text-slate-400 uppercase">Distance</span>
                          </div>
                          <p className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            {directions.distance}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                          <div className="flex items-center gap-1 mb-1">
                            <Clock className="h-3.5 w-3.5 text-purple-400" />
                            <span className="text-xs text-slate-400 uppercase">ETA</span>
                          </div>
                          <p className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            {directions.duration}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* GPS Coordinates */}
                {busStatus && (
                  <Card className="bg-white/5 border-white/10 backdrop-blur-sm shrink-0">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Compass className="h-4 w-4 text-green-400" />
                        <span className="text-xs text-slate-400 uppercase font-medium">GPS Coordinates</span>
                      </div>
                      <div className="font-mono text-xs text-white bg-black/30 p-2.5 rounded-lg border border-white/10">
                        <span className="text-slate-400">Lat:</span> {busStatus.mlat.toFixed(6)} &nbsp;
                        <span className="text-slate-400">Lng:</span> {busStatus.mlng.toFixed(6)}
                      </div>
                      {locationName && (
                        <div className="mt-2 text-xs text-slate-300">
                          <span className="text-slate-400">Location:</span> {locationName}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Contact Info - Compact */}
                <Card className="bg-white/5 border-white/10 backdrop-blur-sm shrink-0">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-slate-400 uppercase font-medium">Support</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-white">
                      <p className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        support@globalschool.edu
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        +91-XXXX-XXXXXX
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Map */}
              <div className="lg:col-span-8 xl:col-span-9 h-full min-h-[300px]">
                <Card className="bg-white/5 border-white/10 backdrop-blur-sm overflow-hidden h-full flex flex-col">
                  <div className="p-3 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-cyan-500/10 to-transparent shrink-0">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-cyan-400" />
                      <span className="text-sm font-semibold text-white">Live Map</span>
                    </div>
                    {(wsConnected || (!!lastUpdate && Date.now() - lastUpdate.getTime() < 15000)) && (
                      <span className="flex items-center gap-1.5 text-xs text-green-400">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        Real-time
                      </span>
                    )}
                  </div>
                  <div className="relative flex-1">
                    {busStatus ? (
                      <>
                        <GoogleMap
                          markers={[
                            {
                              lat: busStatus.mlat,
                              lng: busStatus.mlng,
                              label: busData?.plateNumber || busStatus.nm,
                              status: busStatus.online ? "online" : "offline",
                              type: "bus",
                            },
                            ...(parentLocation
                              ? [
                                {
                                  lat: parentLocation.latitude,
                                  lng: parentLocation.longitude,
                                  label: "You",
                                  type: "user",
                                },
                              ]
                              : []),
                            ...(directions?.polyline && parentLocation
                              ? [
                                {
                                  lat: 0,
                                  lng: 0,
                                  type: "polyline",
                                  path: directions.polyline,
                                },
                              ]
                              : []),
                          ]}
                          height="100%"
                          width="100%"
                        />
                        {/* Compact Legend */}
                        <div className="absolute bottom-3 left-3 bg-slate-900/95 backdrop-blur-sm border border-white/10 rounded-lg p-2.5 shadow-xl">
                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5 text-white">
                              <Bus className="h-3.5 w-3.5 text-blue-400" />
                              <span>Bus</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-white">
                              <MapPin className="h-3.5 w-3.5 text-red-400" />
                              <span>You</span>
                            </div>
                            {directions && (
                              <div className="flex items-center gap-1.5 text-white">
                                <div className="w-4 h-0.5 bg-blue-500 rounded" />
                                <span>Route</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="h-full flex items-center justify-center bg-slate-800/50">
                        <div className="text-center">
                          <MapPin className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                          <p className="text-slate-400 text-sm">Waiting for location...</p>
                          <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mt-3" />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Compact Footer */}
      <footer className="relative z-10 border-t border-white/10 bg-slate-900/50 backdrop-blur-sm shrink-0">
        <div className="max-w-7xl mx-auto px-3 py-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Bus className="h-4 w-4 text-blue-400" />
              <span className="font-semibold text-slate-300">BusTracker</span>
              <span className="hidden sm:inline text-slate-400">• School Transport System</span>
            </div>
            <span className="text-slate-400">© {new Date().getFullYear()} • v1.0</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
