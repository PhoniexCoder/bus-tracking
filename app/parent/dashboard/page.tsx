"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Bus, Clock, LogOut, MapPin, Navigation, RefreshCw, Users } from "lucide-react"
import { auth } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { config } from "@/lib/config"
import { fetchBackendAPI } from "@/lib/backend-auth"
import { FirestoreService, type StudentProfile } from "@/lib/firestore"
import type { DirectionsResult, LatLng } from "@/lib/google-maps"
import { GoogleMapsService } from "@/lib/google-maps"
import { GoogleMap } from "@/components/google-map"

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
  const { user, userRole, logout } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<StudentProfile | null>(null)
  const [busStatus, setBusStatus] = useState<ParentBusStatus | null>(null)
  const [busData, setBusData] = useState<any>(null) // Bus data from Firebase
  const [parentLocation, setParentLocation] = useState<ParentLocation | null>(null)
  const [directions, setDirections] = useState<DirectionsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [wsConnected, setWsConnected] = useState(false) // WebSocket connection status

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
        // The GeolocationPositionError object doesn't serialize well.
        // Log its properties individually for a clear error message.
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

  // Fetch bus status
  const fetchBusStatus = useCallback(async () => {
    if (!profile?.assignedBusId) return

    try {
      // Fetch bus data from Firebase
      if (user) {
        const firestoreService = new FirestoreService(user.uid);
        const allBuses = await firestoreService.getAllBuses();
        const firebaseBus = allBuses.find(b => b.busId === profile.assignedBusId);
        if (firebaseBus) {
          setBusData(firebaseBus);
        }
      }

      // Fetch from FastAPI backend with authentication
      const response = await fetchBackendAPI(`/api/liveplate?device_id=${encodeURIComponent(profile.assignedBusId)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch bus status")
      }

      const gps = data?.gps || {}
      const status: ParentBusStatus = {
        nm: data?.plate_number || data?.device_name || profile.assignedBusId,
        mlat: Number(gps?.latitude || 0),
        mlng: Number(gps?.longitude || 0),
        dt: gps?.last_update ? new Date(gps.last_update * 1000).toISOString() : new Date().toISOString(),
        online: !!gps?.online,
      }
      setBusStatus(status)
      setLastUpdate(new Date())
    } catch (err) {
      console.error("Error fetching bus status:", err)
      setError("Unable to fetch bus location")
    }
  }, [profile?.assignedBusId, user])

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

  // Load student profile
  useEffect(() => {
    if (!user || (userRole !== "student" && userRole !== "parent")) {
      router.push("/")
      return
    }

    const loadProfile = async () => {
      try {
        const firestoreService = new FirestoreService(user.uid)
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
  }, [user, userRole, router, getCurrentLocation])

  // Calculate directions when bus or student location changes
  useEffect(() => {
    calculateDirections()
  }, [calculateDirections])

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!profile?.assignedBusId) return

    let ws: WebSocket | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null

    const connectWebSocket = () => {
      try {
        // Use environment variable or fallback to localhost
        const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000'
        ws = new WebSocket(`${wsUrl}/ws/live`)

        ws.onopen = () => {
          console.log('✅ WebSocket connected')
          setWsConnected(true)
          setError("")
        }

        ws.onmessage = async (event) => {
          try {
            const liveData = JSON.parse(event.data)
            
            // Find the assigned bus in the live data
            const busDevice = liveData.find((item: any) => item.device_id === profile.assignedBusId)
            
            if (busDevice) {
              // Fetch bus data from Firebase if not already loaded
              if (!busData && user) {
                const firestoreService = new FirestoreService(user.uid)
                const allBuses = await firestoreService.getAllBuses()
                const firebaseBus = allBuses.find(b => b.busId === profile.assignedBusId)
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
              }
              setBusStatus(status)
              setLastUpdate(new Date())
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err)
          }
        }

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error)
          console.log('💡 Make sure backend is running at:', process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000')
          setWsConnected(false)
        }

        ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected. Code:', event.code, 'Reason:', event.reason || 'No reason provided')
          setWsConnected(false)
          
          // Fallback to HTTP polling if WebSocket fails on first connection
          console.log('🔄 Falling back to HTTP polling...')
          fetchBusStatus()
          
          // Attempt to reconnect after 5 seconds
          reconnectTimeout = setTimeout(() => {
            console.log('🔄 Attempting to reconnect WebSocket...')
            connectWebSocket()
          }, 5000)
        }
      } catch (err) {
        console.error('Failed to connect WebSocket:', err)
        setError('Unable to establish real-time connection')
        
        // Fallback to HTTP polling
        fetchBusStatus()
        reconnectTimeout = setTimeout(connectWebSocket, 5000)
      }
    }

    // Initial connection
    connectWebSocket()

    // Cleanup on unmount
    return () => {
      if (ws) {
        ws.close()
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
    }
  }, [profile?.assignedBusId, user, busData, fetchBusStatus])

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  const passengerCount = busStatus?.s1 ? parseInt(busStatus.s1, 10) : null
  if (passengerCount !== null && isNaN(passengerCount)) {
    console.warn(`Could not parse passenger count from busStatus.s1: "${busStatus?.s1}"`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Professional Government Header */}
      <header className="bg-white border-b-4 border-blue-600 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-3 rounded-lg">
                <Bus className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  Parent Dashboard
                </h1>
                <p className="text-sm text-gray-600">School Transport Tracking System</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* WebSocket Status Indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-xs">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-gray-700 hidden sm:inline">{wsConnected ? 'Live' : 'Connecting...'}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                className="border-gray-300 hover:bg-gray-50"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
        <div className="bg-gray-100 border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-700">
                  <strong>Parent:</strong> {profile?.name || "User"}
                </span>
                {profile?.assignedBusId && (
                  <span className="text-gray-700">
                    <strong>Bus ID:</strong> {profile.assignedBusId}
                  </span>
                )}
              </div>
              {lastUpdate && (
                <span className="text-gray-600 text-xs">
                  Last Updated: {lastUpdate.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription className="flex items-center gap-2">
              <span className="font-semibold">Error:</span> {error}
            </AlertDescription>
          </Alert>
        )}

        {!profile?.assignedBusId && !loading && (
          <Card className="mb-6 border-2 border-orange-300 bg-orange-50">
            <CardContent className="p-8 text-center">
              <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bus className="h-10 w-10 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                No Bus Assigned
              </h3>
              <p className="text-gray-700 max-w-md mx-auto">
                Your ward is not currently assigned to a school bus. Please contact the school administration for bus assignment.
              </p>
              <div className="mt-6">
                <Button variant="outline" className="border-orange-600 text-orange-600 hover:bg-orange-50">
                  Contact School Administration
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Status Cards */}
          <div className="lg:col-span-1 space-y-4">
            {/* Bus Status Card */}
            {busStatus && (
              <Card className="border border-gray-300 shadow-sm">
                <CardHeader className="bg-gray-50 border-b border-gray-200 pb-3">
                  <CardTitle className="text-lg font-bold text-gray-900 flex items-center">
                    <Bus className="h-5 w-5 mr-2 text-blue-600" />
                    Vehicle Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Vehicle Number</label>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {busData?.plateNumber || busStatus.nm}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</label>
                    <div className="mt-1">
                      <Badge 
                        variant={busStatus.online ? "default" : "secondary"}
                        className={`${busStatus.online ? 'bg-green-600' : 'bg-gray-400'} text-white font-semibold`}
                      >
                        {busStatus.online ? "● ACTIVE" : "● OFFLINE"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Last Location Update</label>
                    <p className="text-sm text-gray-700 mt-1">{new Date(busStatus.dt).toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">GPS Coordinates</label>
                    <p className="text-xs text-gray-600 font-mono mt-1">
                      {busStatus.mlat.toFixed(6)}, {busStatus.mlng.toFixed(6)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Distance & ETA Card */}
            {directions && (
              <Card className="border border-gray-300 shadow-sm">
                <CardHeader className="bg-gray-50 border-b border-gray-200 pb-3">
                  <CardTitle className="text-lg font-bold text-gray-900 flex items-center">
                    <Navigation className="h-5 w-5 mr-2 text-blue-600" />
                    Travel Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="bg-blue-50 border-l-4 border-blue-600 p-4">
                    <label className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Distance</label>
                    <p className="text-2xl font-bold text-blue-900 mt-1">{directions.distance}</p>
                  </div>
                  <div className="bg-orange-50 border-l-4 border-orange-600 p-4">
                    <label className="text-xs font-semibold text-orange-900 uppercase tracking-wide">Estimated Arrival Time</label>
                    <p className="text-2xl font-bold text-orange-900 mt-1">{directions.duration}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Map */}
          <div className="lg:col-span-2">
            <Card className="border border-gray-300 shadow-sm h-full">
              <CardHeader className="bg-gray-50 border-b border-gray-200 pb-3">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                  Live Vehicle Tracking Map
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {busStatus ? (
                  <div className="h-[600px] lg:h-[700px] relative">
                    <GoogleMap
                      markers={[
                        // Bus marker
                        {
                          lat: busStatus.mlat,
                          lng: busStatus.mlng,
                          label: busData?.plateNumber || busStatus.nm,
                          status: busStatus.online ? 'online' : 'offline',
                          type: 'bus'
                        },
                        // User location marker
                        ...(parentLocation ? [{
                          lat: parentLocation.latitude,
                          lng: parentLocation.longitude,
                          label: 'Your Location',
                          type: 'user'
                        }] : []),
                        // Route polyline
                        ...(directions?.polyline && parentLocation ? [{
                          lat: 0,
                          lng: 0,
                          type: 'polyline',
                          path: directions.polyline
                        }] : [])
                      ]}
                      height="100%"
                      width="100%"
                    />
                    {/* Map Legend */}
                    <div className="absolute bottom-4 left-4 bg-white border-2 border-gray-300 rounded-lg p-3 shadow-lg">
                      <p className="text-xs font-bold text-gray-900 mb-2">Map Legend</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <Bus className="h-3 w-3 text-blue-600" />
                          <span className="text-gray-700">School Bus</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-red-600" />
                          <span className="text-gray-700">Your Location</span>
                        </div>
                        {directions && (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-0.5 bg-blue-600"></div>
                            <span className="text-gray-700">Route</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-[600px] flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <div className="bg-gray-200 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MapPin className="h-10 w-10 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-semibold">Waiting for vehicle location...</p>
                      <div className="mt-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Official Footer */}
      <footer className="bg-gray-800 text-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-bold mb-2">About</h3>
              <p className="text-gray-400">School Transport Tracking System - An initiative for student safety and parent convenience.</p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Support</h3>
              <p className="text-gray-400">For technical support, contact: support@globalschool</p>
            </div>
            <div>
              <h3 className="font-bold mb-2">System Information</h3>
              <p className="text-gray-400">Version 1.0 | Last Updated: October 2025</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
