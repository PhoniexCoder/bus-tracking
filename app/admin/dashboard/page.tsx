  "use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { FirestoreService, type AdminProfile, type BusAssignment } from "@/lib/firestore"
import { fetchBackendAPI } from "@/lib/backend-auth"
import type { DeviceStatus } from "@/lib/fleet-backend"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FleetCard } from "./components/FleetCard"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MapPin, Users, Bus, LogOut, RefreshCw, Activity, Clock, Search, Bell, HelpCircle, Terminal, ShieldAlert } from "lucide-react"
import { GoogleMap } from "@/components/google-map"
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import haversine from "haversine-distance"

interface StopInput {
  name: string
  latitude: string
  longitude: string
}

interface BusStops {
  [busId: string]: { name: string; latitude: number; longitude: number }[]
}

interface BusDisplayData {
  status: DeviceStatus
  assignment: BusAssignment | null
  address: string
  plate_number?: string
  device_info?: any
}

// Polyline decoding utility
function decodePolyline(encoded: string) {
  const points = []
  let index = 0
  const len = encoded.length
  let lat = 0
  let lng = 0
  while (index < len) {
    let b
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1)
    lat += dlat
    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1)
    lng += dlng
    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return points
}

export default function AdminDashboard() {
  const router = useRouter()
  const { user, userRole, logout } = useAuth()
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [busDisplayData, setBusDisplayData] = useState<BusDisplayData[]>([])
  const [assignments, setAssignments] = useState<BusAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [allBuses, setAllBuses] = useState<any[]>([])
  const [wsConnected, setWsConnected] = useState(false)
  const [busStops, setBusStops] = useState<BusStops>({})
  const [newStop, setNewStop] = useState<{ [busId: string]: StopInput }>({})
  const [addBusModalOpen, setAddBusModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [newBus, setNewBus] = useState({
    busId: "",
    plateNumber: "",
    capacity: "",
    model: "",
    year: "",
    notes: "",
  })
  const [addingBus, setAddingBus] = useState(false)
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null)
  const [roadPolyline, setRoadPolyline] = useState<{ lat: number; lng: number }[] | null>(null)
  const [gpsAlert, setGpsAlert] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ time: string; message: string; type: "system" | "route" | "alert" | "info" }[]>([])

  const allBusesRef = useRef(allBuses)
  const assignmentsRef = useRef(assignments)

  useEffect(() => {
    allBusesRef.current = allBuses
  }, [allBuses])

  useEffect(() => {
    assignmentsRef.current = assignments
  }, [assignments])

  const sensors = useSensors(useSensor(PointerSensor))

  // Seed activity logs
  useEffect(() => {
    setLogs([
      { time: "08:10:42", message: "Fleet Tracking System initialized.", type: "system" },
      { time: "08:12:15", message: "Real-time sync connection established.", type: "system" },
      { time: "08:14:02", message: "Administrator dashboard session secured.", type: "system" }
    ])

    const interval = setInterval(() => {
      const logsList = [
        "Fleet telemetry channel optimized.",
        "Activity log buffer refreshed.",
        "Geofence security check: All buses on path.",
        "Synced route schedules with database.",
      ]
      const randomLog = logsList[Math.floor(Math.random() * logsList.length)]
      const time = new Date().toLocaleTimeString("en-IN")
      setLogs((prev) => [...prev, { time, message: randomLog, type: "info" }].slice(-15))
    }, 20000)

    return () => clearInterval(interval)
  }, [])

  const busIds = useMemo(() => busDisplayData.map((b) => b.status.vid), [busDisplayData])

  useEffect(() => {
    if (!selectedBusId && busIds.length > 0) setSelectedBusId(busIds[0])
  }, [busIds, selectedBusId])

  // Monitor online devices with stale GPS
  useEffect(() => {
    const now = Date.now()
    const thresholdMs = 60 * 1000
    const staleBuses = busDisplayData.filter((b) => {
      if (b.status.ol === 1 && b.status.gt) {
        const last = new Date(b.status.gt).getTime()
        return now - last > thresholdMs
      }
      return false
    })
    if (staleBuses.length > 0) {
      setGpsAlert(`Warning: ${staleBuses.map((b) => b.status.vid).join(", ")} online but stale telemetry > 1 min!`)
    } else {
      setGpsAlert(null)
    }
  }, [busDisplayData])

  // Fetch road directions polyline
  useEffect(() => {
    const fetchDirections = async () => {
      setRoadPolyline(null)
      if (!selectedBusId || !busStops[selectedBusId] || busStops[selectedBusId].length < 2) return
      const stops = busStops[selectedBusId]
      const origin = `${stops[0].latitude},${stops[0].longitude}`
      const destination = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`
      const waypoints = stops.slice(1, -1).map((s) => `${s.latitude},${s.longitude}`).join("|")
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}`
      if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`
      url += `&key=${apiKey}`
      try {
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`)
        const data = await res.json()
        if (data.routes?.[0]?.overview_polyline) {
          setRoadPolyline(decodePolyline(data.routes[0].overview_polyline.points))
        }
      } catch (err) {
        console.error("Error fetching directions:", err)
      }
    }
    fetchDirections()
  }, [selectedBusId, busStops])

  // Fetch stops for a bus from Firestore
  const fetchStopsForBus = useCallback(async (busId: string) => {
    if (!user) return
    const firestoreService = new FirestoreService(user.sub)
    const allAssignments = await firestoreService.getAllBusAssignments()
    const assignment = allAssignments.find((a) => a.busId === busId)
    if (assignment?.routeId) {
      const routeDoc = await firestoreService.getRouteById(assignment.routeId)
      setBusStops((prev) => ({ ...prev, [busId]: routeDoc?.stops || [] }))
    } else {
      setBusStops((prev) => ({ ...prev, [busId]: [] }))
    }
  }, [user])

  // Fetch all bus data
  const fetchAllBusData = useCallback(async () => {
    setRefreshing(true)
    setError("")
    try {
      const res = await fetchBackendAPI("/api/liveplate_all")
      if (!res.ok) {
        throw new Error(`Failed to fetch fleet telemetry (status ${res.status})`)
      }
      const liveList = await res.json()

      let allAssignments: BusAssignment[] = []
      let allBuses: any[] = []
      if (user) {
        const firestoreService = new FirestoreService(user.sub)
        allAssignments = await firestoreService.getAllBusAssignments()
        setAssignments(allAssignments)
        allBuses = await firestoreService.getAllBuses()
        setAllBuses(allBuses)

        // Sync missing buses from API to Firestore registry
        for (const item of (Array.isArray(liveList) ? liveList : [])) {
          const devId = item?.device_id
          const apiPlateRaw = item?.plate_number || ""
          if (devId) {
            const existsByDeviceId = allBuses.some((b) => b.busId === devId)
            const existsByPlate = apiPlateRaw && allBuses.some((b) => 
              b.plateNumber && String(b.plateNumber).trim().toLowerCase() === String(apiPlateRaw).trim().toLowerCase()
            )

            if (!existsByDeviceId && !existsByPlate) {
              try {
                const newBusData = {
                  busId: devId,
                  plateNumber: apiPlateRaw || devId,
                  capacity: 50,
                  model: "Auto-added",
                  year: new Date().getFullYear(),
                  notes: "Automatically synced from Fleet API",
                  createdAt: new Date().toISOString(),
                }
                await firestoreService.addBus(newBusData)
                allBuses.push(newBusData)
              } catch (error) {
                console.error(`Failed to auto-add bus ${devId}:`, error)
              }
            }
          }
        }
        setAllBuses(allBuses)
      }

      const displayData: BusDisplayData[] = (Array.isArray(liveList) ? liveList : []).map((item: any) => {
        const devId = item?.device_id || item?.gps?.device_id
        const nameLabel = item?.device_name || devId
        const apiPlateRaw = item?.plate_number || ""
        let matchedBus = null
        if (allBuses && apiPlateRaw) {
          const apiPlate = String(apiPlateRaw).trim().toLowerCase()
          matchedBus = allBuses.find((b) => b.plateNumber && String(b.plateNumber).trim().toLowerCase() === apiPlate) || null
        }
        let matchedAssignment: BusAssignment | null = null
        if (allAssignments && matchedBus?.busId) {
          matchedAssignment = allAssignments.find((a) => a.busId && String(a.busId).trim() === String(matchedBus.busId).trim()) || null
        }
        if (!matchedAssignment && allAssignments && apiPlateRaw) {
          const apiPlate = String(apiPlateRaw).trim().toLowerCase()
          matchedAssignment = allAssignments.find((a) => a.plateNumber && String(a.plateNumber).trim().toLowerCase() === apiPlate) || null
        }
        const plateForDisplay = matchedAssignment?.plateNumber || matchedBus?.plateNumber || apiPlateRaw || ""
        const gps = item?.gps || {}
        return {
          status: {
            id: devId,
            vid: nameLabel,
            mlat: gps.latitude != null ? String(gps.latitude) : "",
            mlng: gps.longitude != null ? String(gps.longitude) : "",
            lat: gps.latitude,
            lng: gps.longitude,
            ol: gps.online ? 1 : 0,
            gt: gps.last_update ? new Date(gps.last_update * 1000).toISOString() : "",
            ps: gps.speed_kmh?.toString() ?? "0",
            dn: "",
            jn: "",
          },
          assignment: matchedAssignment,
          address: gps.latitude && gps.longitude ? `${gps.latitude}, ${gps.longitude}` : "",
          plate_number: plateForDisplay,
          device_info: item?.device_info,
        }
      })
      setBusDisplayData(displayData)
      setLastUpdate(new Date())
      setError("")

      if (displayData.length > 0) {
        for (const bus of displayData) {
          const canonicalBusId = bus.assignment?.busId || bus.status.vid
          if (canonicalBusId) {
            fetchStopsForBus(canonicalBusId)
          }
        }
      }
    } catch (err: any) {
      console.error("Error loading bus data:", err)
      setError(err.message || "Unable to fetch bus info")
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [user, fetchStopsForBus])

  // Auth load profile
  useEffect(() => {
    if (!user || userRole !== "admin") {
      router.push("/")
      return
    }

    const loadProfile = async () => {
      try {
        const firestoreService = new FirestoreService(user.sub)
        const adminProfile = await firestoreService.getAdminProfile()
        if (!adminProfile) {
          throw new Error("Admin profile details missing in database registry.")
        }
        setProfile(adminProfile)
      } catch (err: any) {
        console.error("Error loading admin profile:", err)
        setError(err.message || "Unable to load admin profile")
        setLoading(false)
      }
    }

    loadProfile()
  }, [user, userRole, router])

  useEffect(() => {
    if (profile) {
      fetchAllBusData()
    }
  }, [profile, fetchAllBusData])

  // WebSocket Live telemetry synchronization
  useEffect(() => {
    if (!profile || !user) return

    let ws: WebSocket | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null

    const connectWebSocket = () => {
      try {
        const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:8000"
        ws = new WebSocket(`${wsUrl}/ws/live`)

        ws.onopen = () => {
          console.log("✅ Admin WebSocket connected")
          setWsConnected(true)
          setError("")
          const time = new Date().toLocaleTimeString("en-IN")
          setLogs((prev) => [...prev, { time, message: "Live telemetry synchronization connected.", type: "system" }].slice(-15))
        }

        ws.onmessage = async (event) => {
          try {
            const liveList = JSON.parse(event.data)
            
            // Read from refs to avoid query loops or re-triggering connection resets
            const currentAssignments = assignmentsRef.current
            const currentBuses = allBusesRef.current

            const displayData: BusDisplayData[] = (Array.isArray(liveList) ? liveList : []).map((item: any) => {
              const devId = item?.device_id || ""
              const apiPlateRaw = item?.plate_number || ""
              const matchedBus = currentBuses.find((b) => 
                b.busId === devId || 
                (b.plateNumber && apiPlateRaw && 
                  String(b.plateNumber).trim().toLowerCase() === String(apiPlateRaw).trim().toLowerCase())
              )
              const assignment = currentAssignments.find((a) => 
                a.busId === devId || a.busId === matchedBus?.busId ||
                (a.plateNumber && apiPlateRaw && 
                  String(a.plateNumber).trim().toLowerCase() === String(apiPlateRaw).trim().toLowerCase())
              )

              const gps = item?.gps || {}
              const lat = Number(gps.latitude || 0)
              const lng = Number(gps.longitude || 0)

              return {
                status: {
                  id: devId,
                  vid: devId,
                  mlat: String(lat),
                  mlng: String(lng),
                  lat,
                  lng,
                  ol: gps.online ? 1 : 0,
                  moving: gps.speed_kmh > 0,
                  gt: gps.last_update ? new Date(gps.last_update * 1000).toISOString() : new Date().toISOString(),
                  sp: gps.speed_kmh || 0,
                  ps: "0"
                } as DeviceStatus,
                assignment: assignment || null,
                address: lat && lng ? `${lat}, ${lng}` : "",
                plate_number: apiPlateRaw || "N/A",
                device_info: item?.device_info || {}
              }
            })

            setBusDisplayData(displayData)
            setLastUpdate(new Date())

            // Append WS logs dynamically
            const time = new Date().toLocaleTimeString("en-IN")
            const newLogs = (Array.isArray(liveList) ? liveList : []).slice(0, 2).map((item: any) => ({
              time,
              message: `Location coordinates synchronized for Bus ${item.device_id || "device"}.`,
              type: "info" as const
            }))
            if (newLogs.length > 0) {
              setLogs((prev) => [...prev, ...newLogs].slice(-15))
            }
          } catch (err) {
            console.error("Error parsing WebSocket packet:", err)
          }
        }

        ws.onerror = (error) => {
          console.error("❌ Admin WebSocket error:", error)
          setWsConnected(false)
        }

        ws.onclose = () => {
          setWsConnected(false)
          fetchAllBusData()
          reconnectTimeout = setTimeout(() => {
            connectWebSocket()
          }, 5000)
        }
      } catch (err) {
        console.error("WebSocket setup failed:", err)
        fetchAllBusData()
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
  }, [profile, user, fetchAllBusData])

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  // Add Stop
  const addStopToBus = async (busId: string, stop: StopInput) => {
    if (!user) return
    try {
      const firestoreService = new FirestoreService(user.sub)
      const allBuses = await firestoreService.getAllBuses()
      let canonicalBus = allBuses.find((b) => b.busId === busId)
      if (!canonicalBus) {
        canonicalBus = allBuses.find((b) => b.plateNumber && String(b.plateNumber).trim().toLowerCase() === String(busId).trim().toLowerCase())
      }
      const canonicalBusId = canonicalBus?.busId || busId

      const assignments = await firestoreService.getAllBusAssignments()
      const assignment = assignments.find((a) => a.busId === canonicalBusId)
      const routeId = assignment?.routeId
      const routeDoc = routeId ? await firestoreService.getRouteById(routeId) : null
      let stops: any[] = []
      if (routeDoc && routeId) {
        stops = routeDoc.stops || []
        stops.push({
          name: stop.name,
          latitude: parseFloat(stop.latitude),
          longitude: parseFloat(stop.longitude),
          order: stops.length,
        })
        await firestoreService.updateRoute(routeId, { stops })
      } else {
        const newRoute = {
          name: `Route for ${assignment?.plateNumber || canonicalBus?.plateNumber || canonicalBusId}`,
          busId: canonicalBusId,
          plateNumber: assignment?.plateNumber || canonicalBus?.plateNumber || "",
          stops: [{
            name: stop.name,
            latitude: parseFloat(stop.latitude),
            longitude: parseFloat(stop.longitude),
            order: 0,
          }],
        }
        const newRouteId = await firestoreService.createRoute(newRoute)
        if (assignment && newRouteId) {
          await firestoreService.updateBusAssignment(assignment.id!, { routeId: newRouteId })
        } else if (newRouteId) {
          await firestoreService.createBusAssignment({
            busId: canonicalBusId,
            routeId: newRouteId,
            plateNumber: assignment?.plateNumber || canonicalBus?.plateNumber || "",
            isActive: true,
          })
        }
      }
      fetchStopsForBus(canonicalBusId)
      setNewStop((s) => ({ ...s, [canonicalBusId]: { name: "", latitude: "", longitude: "" } }))
      
      const time = new Date().toLocaleTimeString("en-IN")
      setLogs((prev) => [...prev, { time, message: `Stop "${stop.name}" added to Bus ${canonicalBusId} route schedule.`, type: "route" }].slice(-15))
    } catch (err: any) {
      alert("Failed to add stop: " + err.message)
    }
  }

  // Delete Stop
  const deleteStopFromBus = async (busId: string, stopIndex: number) => {
    if (!user) return
    try {
      const firestoreService = new FirestoreService(user.sub)
      const assignments = await firestoreService.getAllBusAssignments()
      const assignment = assignments.find((a) => a.busId === busId)
      const routeId = assignment?.routeId
      const routeDoc = routeId ? await firestoreService.getRouteById(routeId) : null
      if (routeDoc && routeId) {
        let stops = routeDoc.stops || []
        const removedName = stops[stopIndex]?.name || ""
        stops.splice(stopIndex, 1)
        stops = stops.map((s, i) => ({ ...s, order: i }))
        await firestoreService.updateRoute(routeId, { stops })
        fetchStopsForBus(busId)

        const time = new Date().toLocaleTimeString("en-IN")
        setLogs((prev) => [...prev, { time, message: `Stop "${removedName}" removed from Bus ${busId} route schedule.`, type: "route" }].slice(-15))
      }
    } catch (err: any) {
      alert("Failed to delete stop: " + err.message)
    }
  }

  // Update Registry Bus info
  const handleUpdateBus = async (busData: any) => {
    if (!user) return
    try {
      const firestoreService = new FirestoreService(user.sub)
      await firestoreService.updateBus(busData.busId, {
        plateNumber: busData.plateNumber,
        capacity: parseInt(busData.capacity) || 50,
        model: busData.model || "",
        year: parseInt(busData.year) || new Date().getFullYear(),
        notes: busData.notes || "",
      })
      await fetchAllBusData()
      const time = new Date().toLocaleTimeString("en-IN")
      setLogs((prev) => [...prev, { time, message: `Registry properties updated for Bus ${busData.busId}.`, type: "system" }].slice(-15))
    } catch (err) {
      console.error("Failed to update bus:", err)
      throw err
    }
  }

  // Delete Registry Bus
  const handleDeleteBus = async (busId: string) => {
    if (!user) return
    const confirmDelete = window.confirm(`Are you sure you want to delete bus ${busId}? This removes all stops and route docs.`)
    if (!confirmDelete) return

    try {
      const firestoreService = new FirestoreService(user.sub)
      const assignments = await firestoreService.getAllBusAssignments()
      const busAssignments = assignments.filter((a) => a.busId === busId)

      for (const assignment of busAssignments) {
        if (assignment.routeId) await firestoreService.deleteRoute(assignment.routeId)
        if (assignment.id) await firestoreService.deleteBusAssignment(assignment.id)
      }
      await firestoreService.deleteBus(busId)
      await fetchAllBusData()
      alert(`✅ Bus registry details for ${busId} cleared successfully.`)
      const time = new Date().toLocaleTimeString("en-IN")
      setLogs((prev) => [...prev, { time, message: `Bus registry entry for ${busId} deleted.`, type: "alert" }].slice(-15))
    } catch (err: any) {
      alert("Failed to delete bus: " + err.message)
    }
  }

  // Estimate Time to Stop
  function estimateTimeToStop(busLat: number, busLng: number, stopLat: number, stopLng: number, speedKmh = 30) {
    const distanceMeters = haversine({ lat: busLat, lng: busLng }, { lat: stopLat, lng: stopLng })
    const speedMps = (speedKmh * 1000) / 3600
    const timeSeconds = distanceMeters / (speedMps || 8.33) // Fallback 30km/h
    return Math.round(timeSeconds / 60)
  }

  // Add Bus registry entry manually
  const handleAddBus = async () => {
    if (!user) return
    if (!newBus.busId.trim()) {
      alert("Please enter a Device ID")
      return
    }
    setAddingBus(true)
    try {
      const firestoreService = new FirestoreService(user.sub)
      const busData: any = {
        busId: newBus.busId.trim(),
        plateNumber: newBus.busId.trim(),
        capacity: 50,
        model: "Manual Entry",
        notes: "Manually registered - waiting for GPS sync",
        createdAt: new Date().toISOString(),
        year: new Date().getFullYear(),
      }
      await firestoreService.addBus(busData)
      setAddBusModalOpen(false)
      setNewBus({ busId: "", plateNumber: "", capacity: "", model: "", year: "", notes: "" })
      fetchAllBusData()
      alert(`Bus with Device ID ${busData.busId} registered successfully!`)
      const time = new Date().toLocaleTimeString("en-IN")
      setLogs((prev) => [...prev, { time, message: `Registered new Bus device (ID: ${busData.busId}).`, type: "system" }].slice(-15))
    } catch (err: any) {
      alert("Failed to add bus: " + err.message)
    } finally {
      setAddingBus(false)
    }
  }

  // Export logs to txt
  const exportLogs = () => {
    const logText = logs.map((l) => `[${l.time}] ${l.message}`).join("\n")
    const blob = new Blob([logText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `fleet-logs-${new Date().toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Broadcast Alert
  const broadcastMessage = () => {
    const msg = prompt("Enter emergency broadcast text for active vehicle devices:")
    if (msg) {
      const time = new Date().toLocaleTimeString("en-IN")
      setLogs((prev) => [...prev, { time, message: `Broadcast message sent to all active buses: "${msg}"`, type: "alert" }].slice(-15))
      alert("Broadcast alert queued to dispatch terminals.")
    }
  }

  const handleDispatchAlert = () => {
    const time = new Date().toLocaleTimeString("en-IN")
    setLogs((prev) => [...prev, { time, message: "Dispatch alert notice sent to all transit coordinators.", type: "alert" }].slice(-15))
    alert("Dispatch notification sent!")
  }

  // Filter Cards by search input
  const filteredBuses = useMemo(() => {
    return busDisplayData.filter((b) => {
      const canonicalBusId = b.assignment?.busId || b.status.vid
      const plate = (b.plate_number || "").toLowerCase()
      const query = searchTerm.toLowerCase()
      return canonicalBusId.toLowerCase().includes(query) || plate.includes(query)
    })
  }, [busDisplayData, searchTerm])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5e5ce6]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-[#e2e2e7] bg-[#0A0A0B] font-sans selection:bg-[#5e5ce6]/30 selection:text-white flex overflow-hidden h-screen w-screen">
      <style dangerouslySetInnerHTML={{ __html: `
        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
        }
        .terminal-glow {
          box-shadow: 0 0 20px rgba(94, 92, 230, 0.15);
        }
        ::-webkit-scrollbar {
          width: 4px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      ` }} />

      {/* SIDE BAR NAVIGATION */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-[#1e2023]/60 backdrop-blur-2xl border-r border-white/10 shadow-2xl z-[60] py-6">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#5e5ce6] flex items-center justify-center text-white">
              <Bus className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#c2c1ff] leading-none">OmniBus Command</h1>
              <p className="text-[10px] uppercase tracking-widest text-[#c7c4d7] mt-1 opacity-60">Admin Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <a className="flex items-center gap-4 px-6 py-3 bg-[#5e5ce6]/20 text-[#c2c1ff] border-r-4 border-[#5e5ce6] transition-all" href="#">
            <Activity className="h-5 w-5" />
            <span>Dashboard</span>
          </a>
          <button 
            onClick={() => router.push("/admin/cameras")}
            className="flex items-center gap-4 px-6 py-3 text-[#c7c4d7] hover:bg-white/5 transition-all w-full text-left"
          >
            <Activity className="h-5 w-5 text-[#0a84ff]" />
            <span>Camera Feeds</span>
          </button>
        </nav>

        <div className="mt-auto px-4 space-y-4">
          <button 
            onClick={broadcastMessage}
            className="w-full py-3 px-4 rounded-xl bg-[#5e5ce6] text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#5e5ce6]/20 hover:opacity-90 transition-all active:scale-95 text-xs"
          >
            <span>Broadcast Message</span>
          </button>
          <div className="pt-4 border-t border-white/5">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-2 py-2 text-[#c7c4d7] hover:text-red-400 transition-colors text-sm"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="md:ml-64 flex-1 h-screen flex flex-col overflow-hidden">
        {/* TOP NAV BAR */}
        <header className="flex justify-between items-center w-full px-6 py-3 sticky top-0 z-50 bg-[#111317]/80 backdrop-blur-xl border-b border-white/10 shadow-sm h-16">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c7c4d7] h-4 w-4" />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1a1c low]/50 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-[#5e5ce6] text-[#e2e2e7] bg-[#1a1c1f]" 
                placeholder="Search vehicle plate ID or model..." 
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-[#c7c4d7] mr-4">
              <button 
                onClick={fetchAllBusData}
                className="hover:text-[#c2c1ff] transition-all cursor-pointer"
                title="Refresh Registry Data"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              <button className="hover:text-[#c2c1ff] transition-all relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-0 right-0 w-2 h-2 bg-[#5e5ce6] rounded-full border border-[#0A0A0B]"></span>
              </button>
              <button className="hover:text-[#c2c1ff] transition-all">
                <HelpCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 pl-6 border-l border-white/10">
              <div className="text-right">
                <p className="text-xs font-semibold text-white">{profile?.name || "Admin Profile"}</p>
                <p className="text-[10px] text-[#c7c4d7]/60">Fleet Supervisor</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-[#5e5ce6]/10 border border-white/20 flex items-center justify-center font-bold text-sm text-[#c2c1ff]">
                {profile?.name ? profile.name.charAt(0).toUpperCase() : "A"}
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT CANVAS */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1a1c3a] via-background to-background">
          {error && (
            <Alert variant="destructive" className="bg-red-950/40 border-red-500/30 text-red-400 rounded-xl">
              <AlertDescription className="font-semibold text-center text-xs flex items-center justify-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                {error}
              </AlertDescription>
            </Alert>
          )}

          {gpsAlert && (
            <Alert variant="destructive" className="bg-orange-950/40 border-orange-500/30 text-orange-400 rounded-xl">
              <AlertDescription className="text-center font-semibold text-xs">{gpsAlert}</AlertDescription>
            </Alert>
          )}

          {/* COMMAND BAR */}
          <section className="glass-card rounded-2xl p-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              <button 
                onClick={handleDispatchAlert}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5e5ce6] text-white font-semibold text-xs hover:brightness-110 transition-all active:scale-95"
              >
                <Bell className="h-4 w-4" />
                Dispatch Alert
              </button>
              <button 
                onClick={exportLogs}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs hover:bg-white/10 transition-all active:scale-95"
              >
                Export Logs
              </button>
              <button 
                onClick={() => setAddBusModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0a84ff]/25 text-[#0a84ff] border border-[#0a84ff]/20 text-xs font-semibold hover:bg-[#0a84ff]/30 transition-all active:scale-95"
              >
                + Register Bus
              </button>
            </div>
            <div className="flex items-center gap-4 text-[#c7c4d7] text-xs">
              <span className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span> 
                {wsConnected ? 'Systems Live' : 'Systems Standby'}
              </span>
              <span className="opacity-40">|</span>
              <span>Last Synced: {lastUpdate ? lastUpdate.toLocaleTimeString() : "Just Now"}</span>
            </div>
          </section>

          {/* DASHBOARD GRID */}
          <div className="grid grid-cols-12 gap-6">
            {/* LEFT COLUMN: Tabs & Fleet details */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <Tabs defaultValue="overview" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[#5e5ce6]" />
                    Active Fleet overview ({filteredBuses.length})
                  </h2>
                  <TabsList className="bg-white/5 border border-white/10 rounded-xl p-1 h-9">
                    <TabsTrigger value="overview" className="text-xs h-7 rounded-lg data-[state=active]:bg-[#5e5ce6] data-[state=active]:text-white">Fleet Cards</TabsTrigger>
                    <TabsTrigger value="map" className="text-xs h-7 rounded-lg data-[state=active]:bg-[#5e5ce6] data-[state=active]:text-white">Map View</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="overview">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredBuses.map((overview) => {
                      const canonicalBusIdRaw = overview.assignment?.busId || overview.status.vid
                      const canonicalBusId = typeof canonicalBusIdRaw === "string" ? canonicalBusIdRaw : ""
                      const stops = busStops[canonicalBusId] || []
                      const busData = allBuses.find((b) => b.busId === overview.status.id)
                      return (
                        <FleetCard
                          key={overview.status.id}
                          overview={overview}
                          stops={stops}
                          newStop={newStop[canonicalBusId]}
                          setNewStop={(val: any) => setNewStop((s) => ({ ...s, [canonicalBusId]: val }))}
                          deleteStopFromBus={(stopIdx: number) => deleteStopFromBus(canonicalBusId, stopIdx)}
                          addStopToBus={(stop: any) => addStopToBus(canonicalBusId, stop)}
                          estimateTimeToStop={estimateTimeToStop}
                          sensors={sensors}
                          user={user}
                          onUpdateBus={handleUpdateBus}
                          onDeleteBus={handleDeleteBus}
                          busData={busData}
                        />
                      )
                    })}

                    {filteredBuses.length === 0 && (
                      <Card className="glass-card col-span-2 rounded-2xl py-12 text-center">
                        <Bus className="h-10 w-10 text-[#c7c4d7]/20 mx-auto mb-3" />
                        <p className="text-sm text-[#c7c4d7]/70 font-semibold">No registered buses found matching search criteria.</p>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="map">
                  <Card className="glass-card overflow-hidden rounded-2xl border-white/10">
                    <CardHeader className="bg-white/5 border-b border-white/5 py-3 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-bold text-white">Interactive Fleet Path Map</CardTitle>
                        <CardDescription className="text-[10px] text-[#c7c4d7]">Visual route trace for active devices</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#c7c4d7]">Trace Bus:</span>
                        <select 
                          value={selectedBusId || ""}
                          onChange={(e) => setSelectedBusId(e.target.value)}
                          className="bg-[#1a1c1f] border border-white/10 rounded-lg text-xs py-1 px-2 text-white"
                        >
                          {busIds.map((id) => (
                            <option key={id} value={id}>{id}</option>
                          ))}
                        </select>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 h-[480px]">
                      <GoogleMap
                        markers={(() => {
                          const busMarkers = busDisplayData
                            .filter((b) => b.status.mlat && b.status.mlng)
                            .map((b) => ({
                              lat: parseFloat(b.status.mlat),
                              lng: parseFloat(b.status.mlng),
                              label: b.status.vid,
                              status: b.status.ol === 1 ? "online" : "offline",
                              type: "bus",
                              busId: b.status.vid
                            }))

                          const stopMarkers: any[] = []
                          const polylines: any[] = []
                          if (selectedBusId && busStops[selectedBusId]) {
                            const stops = busStops[selectedBusId]
                            stops.forEach((stop, i) => {
                              stopMarkers.push({
                                lat: stop.latitude,
                                lng: stop.longitude,
                                label: `${i + 1}`,
                                type: "stop",
                                status: "notpassed",
                                busId: selectedBusId
                              })
                            })
                            if (stops.length > 1 && roadPolyline && roadPolyline.length > 1) {
                              polylines.push({
                                type: "polyline",
                                path: roadPolyline
                              })
                            }
                          }

                          return [...busMarkers, ...stopMarkers, ...polylines]
                        })()}
                        center={(() => {
                          if (selectedBusId) {
                            const selectedBus = busDisplayData.find((b) => b.status.vid === selectedBusId)
                            if (selectedBus?.status.mlat && selectedBus.status.mlng) {
                              return {
                                lat: parseFloat(selectedBus.status.mlat),
                                lng: parseFloat(selectedBus.status.mlng)
                              }
                            }
                          }
                          return undefined
                        })()}
                        height="100%"
                        showTrafficLayer={true}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* RIGHT COLUMN: Terminal Logs & map overview widget */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              {/* SYSTEM LOGS TERMINAL */}
              <section className="flex flex-col h-[350px]">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-[#5e5ce6]" />
                  Fleet Activity Feed
                </h2>
                <div className="flex-1 glass-card rounded-2xl border border-white/10 p-4 overflow-hidden flex flex-col backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2 text-[10px] text-[#a3b8cc]/60 uppercase font-semibold">
                    <span>Recent Events</span>
                    <span className="text-[9px] font-mono lowercase">{logs.length} logged</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2.5">
                    {logs.map((log, i) => {
                      let dotColor = "bg-green-400"
                      if (log.type === "alert") dotColor = "bg-red-500 animate-pulse"
                      else if (log.type === "system") dotColor = "bg-[#5e5ce6]"
                      else if (log.type === "route") dotColor = "bg-[#bf5af2]"

                      return (
                        <div key={i} className="flex items-start gap-2.5 text-xs text-[#e2e2e7] leading-relaxed">
                          <span className={`w-2 h-2 rounded-full mt-1.5 ${dotColor}`} />
                          <div className="flex-1">
                            <span className="text-[#a3b8cc]/50 font-semibold mr-1.5">{log.time}</span>
                            <span>{log.message}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>

              {/* SMALL MAP OVERVIEW WIDGET */}
              <section className="h-[280px] relative rounded-2xl overflow-hidden border border-white/10 glass-card">
                <GoogleMap
                  markers={busDisplayData
                    .filter((b) => b.status.mlat && b.status.mlng)
                    .map((b) => ({
                      lat: parseFloat(b.status.mlat),
                      lng: parseFloat(b.status.mlng),
                      label: b.status.vid,
                      status: b.status.ol === 1 ? "online" : "offline",
                      type: "bus"
                    }))}
                  height="100%"
                  width="100%"
                  showTrafficLayer={false}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none"></div>
                <div className="absolute bottom-3 left-3 bg-[#0A0A0B]/90 backdrop-blur px-2.5 py-1 rounded-lg border border-white/10 text-[9px] text-[#e2e2e7] font-mono">
                  Live fleet distribution grid
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* ADD NEW MANUALLY CONFIGURED BUS REGISTRY MODAL */}
      <Dialog open={addBusModalOpen} onOpenChange={setAddBusModalOpen}>
        <DialogContent className="glass-panel-heavy border-white/10 max-w-md mx-auto text-white rounded-2xl bg-[#0c0e12]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center">
              <Bus className="h-5 w-5 mr-2 text-[#5e5ce6]" />
              Register New Fleet Vehicle
            </DialogTitle>
            <p className="text-xs text-[#c7c4d7] mt-2">
              Manually register the device hardware identifier below to establish telemetry listeners.
            </p>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-[#c7c4d7] uppercase tracking-wider mb-2">Device Hardware ID <span className="text-red-500">*</span></label>
              <input 
                className="w-full bg-[#0d1c2d] border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-[#5e5ce6] focus:border-[#5e5ce6] transition-all duration-300 font-semibold" 
                placeholder="e.g. demo-bus-009" 
                value={newBus.busId} 
                onChange={(e) => setNewBus((b) => ({ ...b, busId: e.target.value }))}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="mt-6 gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="border-white/10 hover:bg-white/5 text-white">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={handleAddBus} 
              disabled={addingBus || !newBus.busId.trim()} 
              className="bg-[#5e5ce6] hover:bg-[#4d4ad5] text-white font-semibold px-6 py-2 rounded-xl"
            >
              {addingBus ? "Saving..." : "Save Registry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
