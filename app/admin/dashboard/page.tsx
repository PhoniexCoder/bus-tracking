"use client";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import {CSS, useCombinedRefs} from '@dnd-kit/utilities';
// Sortable Stop Item
function SortableStopItem({ stop, index, id, onDelete, attributes, listeners, isDragging, style, setNodeRef }: any) {
  return (
    <li
      ref={setNodeRef}
      className={`flex items-center justify-between bg-gray-50 rounded px-3 py-2 border border-gray-200 mb-1 shadow-sm transition-all duration-200 ${isDragging ? 'scale-105 shadow-lg bg-blue-50 z-10' : ''}`}
      {...attributes}
      {...listeners}
      style={style}
    >
      <div>
        <div className="font-semibold text-base text-gray-900 flex items-center gap-2">
          <span className="cursor-grab select-none text-gray-400">&#9776;</span>
          <span>{index + 1}.</span> {stop.name}
        </div>
        <div className="text-xs text-gray-500">Lat: {stop.latitude}, Lng: {stop.longitude}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Button size="sm" variant="destructive" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </li>
  );
}

function DraggableStop({ stop, index, id, onDelete }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
    cursor: 'grab',
    zIndex: isDragging ? 100 : undefined,
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : undefined,
  };
  return (
    <SortableStopItem
      stop={stop}
      index={index}
      id={id}
      onDelete={onDelete}
      attributes={attributes}
      listeners={listeners}
      isDragging={isDragging}
      style={style}
      setNodeRef={setNodeRef}
    />
  );
}

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { FirestoreService, type AdminProfile, type BusAssignment } from "@/lib/firestore"
import { config } from "@/lib/config"
import { fetchBackendAPI } from "@/lib/backend-auth"
import type { DeviceStatus } from "@/lib/fleet-backend"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FleetCard } from "./components/FleetCard"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MapPin, Users, Bus, LogOut, RefreshCw, Activity, Clock } from "lucide-react"
import { GoogleMap } from "@/components/google-map"
// Polyline decoding utility (Google polyline algorithm)
function decodePolyline(encoded: string) {
  let points = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;
  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}


import haversine from 'haversine-distance';

// Local state types for stops modal

interface StopInput {
  name: string;
  latitude: string;
  longitude: string;
}

interface BusStops {
  [busId: string]: { name: string; latitude: number; longitude: number }[];
}

// This new interface combines the live status with its Firestore assignment data
interface BusDisplayData {
  status: DeviceStatus;
  assignment: BusAssignment | null;
  address: string;
  plate_number?: string;
  device_info?: any;
  // occupancy removed
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
  const [allBuses, setAllBuses] = useState<any[]>([]) // Store all buses from Firestore
  const [wsConnected, setWsConnected] = useState(false) // WebSocket connection status

  // Local state for stops per bus (from Firestore)
  const [busStops, setBusStops] = useState<BusStops>({});
  // Local state for new stop input per bus (for modal)
  const [newStop, setNewStop] = useState<{ [busId: string]: StopInput }>({});
  // Modal open state per bus
  const [openModal, setOpenModal] = useState<{ [busId: string]: boolean }>({});
  const [addBusModalOpen, setAddBusModalOpen] = useState(false);
  const [newBus, setNewBus] = useState({
    busId: '',
    plateNumber: '',
    capacity: '',
    model: '',
    year: '',
    notes: '',
  });
  const [addingBus, setAddingBus] = useState(false);

  // Bus selection for route/traffic map
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  // Use vid (vehicle id) for selection and mapping
  const busIds = useMemo(() => busDisplayData.map(b => b.status.vid), [busDisplayData]);
  useEffect(() => {
    if (!selectedBusId && busIds.length > 0) setSelectedBusId(busIds[0]);
  }, [busIds, selectedBusId]);

  // Road-following polyline state
  const [roadPolyline, setRoadPolyline] = useState<{ lat: number; lng: number }[] | null>(null);

  // Alert for GPS device not sending coordinates while online
  const [gpsAlert, setGpsAlert] = useState<string | null>(null);

  // DnD-kit sensors (must be at top level)
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    // Check for any online bus with stale GPS
    const now = Date.now();
  const thresholdMs = 60 * 1000; // 60 seconds
    const staleBuses = busDisplayData.filter(b => {
      if (b.status.ol === 1 && b.status.gt) {
        const last = new Date(b.status.gt).getTime();
        return now - last > thresholdMs;
      }
      return false;
    });
    if (staleBuses.length > 0) {
      setGpsAlert(`Warning: ${staleBuses.map(b => b.status.vid).join(', ')} ${staleBuses.length > 1 ? 'are' : 'is'} online but has not sent GPS data in over 1 minute!`);
    } else {
      setGpsAlert(null);
    }
  }, [busDisplayData]);

  // Fetch road-following route when selected bus or stops change
  useEffect(() => {
    const fetchDirections = async () => {
      setRoadPolyline(null);
      if (!selectedBusId || !busStops[selectedBusId] || busStops[selectedBusId].length < 2) return;
      const stops = busStops[selectedBusId];
      const origin = `${stops[0].latitude},${stops[0].longitude}`;
      const destination = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;
      const waypoints = stops.slice(1, -1).map(s => `${s.latitude},${s.longitude}`).join('|');
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}`;
      if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
      url += `&key=${apiKey}`;
      try {
        const res = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`); // Use a proxy to avoid CORS
        const data = await res.json();
        if (data.routes && data.routes[0] && data.routes[0].overview_polyline) {
          setRoadPolyline(decodePolyline(data.routes[0].overview_polyline.points));
        }
        // keep polyline if available; don't clear immediately here
      } catch (err) {
        // Optionally handle error
      }
    };
    fetchDirections();
  }, [selectedBusId, busStops]);

  // Fetch bus info from FastAPI and merge with Firestore assignments
  const fetchAllBusData = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const res = await fetchBackendAPI('/api/liveplate_all')
      if (!res.ok) {
        let bodyText = "";
        try { bodyText = await res.text(); } catch {}
        throw new Error(`Failed to fetch bus info from FastAPI (status ${res.status}) ${bodyText ? `- ${bodyText}` : ""}`)
      }
      const liveList = await res.json()

      // Fetch assignments and buses from Firestore
      let allAssignments: BusAssignment[] = [];
      let allBuses: any[] = [];
      if (user) {
        const firestoreService = new FirestoreService(user.uid);
        allAssignments = await firestoreService.getAllBusAssignments();
        setAssignments(allAssignments);
        allBuses = await firestoreService.getAllBuses();
        setAllBuses(allBuses); // Store in state

        // Auto-add buses from backend that don't exist in Firestore
        for (const item of (Array.isArray(liveList) ? liveList : [])) {
          const devId = item?.device_id;
          const apiPlateRaw = item?.plate_number || "";
          
          if (devId) {
            // Check if bus already exists by device ID or plate number
            const existsByDeviceId = allBuses.some(b => b.busId === devId);
            const existsByPlate = apiPlateRaw && allBuses.some(b => 
              b.plateNumber && String(b.plateNumber).trim().toLowerCase() === String(apiPlateRaw).trim().toLowerCase()
            );

            // If bus doesn't exist, create it
            if (!existsByDeviceId && !existsByPlate) {
              try {
                const newBusData = {
                  busId: devId,
                  plateNumber: apiPlateRaw || devId,
                  capacity: 50, // Default capacity
                  model: 'Auto-added',
                  year: new Date().getFullYear(),
                  notes: 'Automatically added from Fleet API',
                  createdAt: new Date().toISOString(),
                };
                
                await firestoreService.addBus(newBusData);
                allBuses.push(newBusData);
                console.log(`✅ Auto-added bus: ${devId} (${apiPlateRaw || 'No plate'})`);
              } catch (error) {
                console.error(`Failed to auto-add bus ${devId}:`, error);
              }
            }
          }
        }
        
        // Update state with newly added buses
        setAllBuses(allBuses);
      }

      const displayData: BusDisplayData[] = (Array.isArray(liveList) ? liveList : []).map((item: any) => {
        const devId = item?.device_id || item?.gps?.device_id;
        const nameLabel = item?.device_name || devId;
        const apiPlateRaw = item?.plate_number || "";
        // Try to match by plate number from API to Firestore buses (case-insensitive)
        let matchedBus = null as any;
        if (allBuses && apiPlateRaw) {
          const apiPlate = String(apiPlateRaw).trim().toLowerCase();
          matchedBus = allBuses.find(b => b.plateNumber && String(b.plateNumber).trim().toLowerCase() === apiPlate) || null;
        }
        let matchedAssignment: BusAssignment | null = null;
        if (allAssignments && matchedBus?.busId) {
          matchedAssignment = allAssignments.find(a => a.busId && String(a.busId).trim() === String(matchedBus.busId).trim()) || null;
        }
        // Also try matching assignment by plate number directly if bus match not found
        if (!matchedAssignment && allAssignments && apiPlateRaw) {
          const apiPlate = String(apiPlateRaw).trim().toLowerCase();
          matchedAssignment = allAssignments.find(a => a.plateNumber && String(a.plateNumber).trim().toLowerCase() === apiPlate) || null;
        }
        // Prefer Firestore plate number for display if available
  const plateForDisplay = matchedAssignment?.plateNumber || matchedBus?.plateNumber || apiPlateRaw || "";
        const gps = item?.gps || {};
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
            ps: gps.speed_kmh?.toString() ?? "",
            dn: "",
            jn: "",
          },
          assignment: matchedAssignment,
          address: gps.latitude && gps.longitude ? `${gps.latitude}, ${gps.longitude}` : "",
          plate_number: plateForDisplay,
          device_info: item?.device_info,
        } as BusDisplayData;
      });
      setBusDisplayData(displayData);
      setLastUpdate(new Date());
      setError("");

      // Fetch stops for each bus after loading bus data
      if (displayData.length > 0) {
        for (const bus of displayData) {
          const canonicalBusId = bus.assignment?.busId || bus.status.vid;
          if (canonicalBusId) {
            fetchStopsForBus(canonicalBusId);
          }
        }
      }
    } catch (err: any) {
      console.error("Error fetching bus info from fleet API:", err);
      setError(err.message || "Unable to fetch bus info");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [user]);

  // Initial data load
  useEffect(() => {
    if (!user || userRole !== "admin") {
      router.push("/")
      return
    }

    const loadProfile = async () => {
      try {
        const firestoreService = new FirestoreService(user.uid)
        const adminProfile = await firestoreService.getAdminProfile()
        if (!adminProfile) {
          throw new Error("Admin profile not found in Firestore. Please ensure it has been created correctly.")
        }
        setProfile(adminProfile)
      } catch (err) {
        console.error("Error loading profile:", err)
        setError(err instanceof Error ? err.message : "Unable to load admin profile")
        setLoading(false)
      }
    }

    loadProfile()
  }, [user, userRole])

  useEffect(() => {
    if (profile) {
      console.log('🔄 Initial data fetch triggered')
      fetchAllBusData()
      if (user) {
        const firestoreService = new FirestoreService(user.uid)
      }
    }
  }, [profile, user, fetchAllBusData])

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!profile || !user) return

    let ws: WebSocket | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null

    const connectWebSocket = () => {
      try {
        const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000'
        ws = new WebSocket(`${wsUrl}/ws/live`)

        ws.onopen = () => {
          console.log('✅ Admin WebSocket connected')
          setWsConnected(true)
          setError("")
        }

        ws.onmessage = async (event) => {
          try {
            const liveList = JSON.parse(event.data)
            
            // Fetch assignments and buses from Firestore if needed
            const firestoreService = new FirestoreService(user.uid)
            const allAssignments = await firestoreService.getAllBusAssignments()
            setAssignments(allAssignments)
            
            let currentBuses = allBuses
            if (currentBuses.length === 0) {
              currentBuses = await firestoreService.getAllBuses()
              setAllBuses(currentBuses)
            }

            // Process live data
            const displayData: BusDisplayData[] = (Array.isArray(liveList) ? liveList : []).map((item: any) => {
              const devId = item?.device_id || ''
              const apiPlateRaw = item?.plate_number || ''
              
              const matchedBus = currentBuses.find(b => 
                b.busId === devId || 
                (b.plateNumber && apiPlateRaw && 
                  String(b.plateNumber).trim().toLowerCase() === String(apiPlateRaw).trim().toLowerCase())
              )
              
              const assignment = allAssignments.find(a => 
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
                  lat: lat,
                  lng: lng,
                  ol: gps.online ? 1 : 0,
                  moving: gps.speed > 0,
                  gt: gps.last_update ? new Date(gps.last_update * 1000).toISOString() : new Date().toISOString(),
                  sp: gps.speed || 0,
                  ps: '0'
                } as DeviceStatus,
                assignment: assignment || null,
                address: item?.address || '',
                plate_number: apiPlateRaw || 'N/A',
                device_info: item?.device_info || {}
              }
            })

            setBusDisplayData(displayData)
            setLastUpdate(new Date())
            setRefreshing(false)
          } catch (err) {
            console.error('Error parsing WebSocket message:', err)
          }
        }

        ws.onerror = (error) => {
          console.error('❌ Admin WebSocket error:', error)
          console.log('💡 Make sure backend is running at:', process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000')
          setWsConnected(false)
        }

        ws.onclose = (event) => {
          console.log('🔌 Admin WebSocket disconnected. Code:', event.code, 'Reason:', event.reason || 'No reason provided')
          setWsConnected(false)
          
          // Fallback to HTTP polling if WebSocket fails
          if (busDisplayData.length === 0) {
            console.log('🔄 Falling back to HTTP polling...')
            fetchAllBusData()
          }
          
          reconnectTimeout = setTimeout(() => {
            console.log('🔄 Attempting to reconnect Admin WebSocket...')
            connectWebSocket()
          }, 5000)
        }
      } catch (err) {
        console.error('Failed to connect Admin WebSocket:', err)
        
        // Fallback to HTTP polling
        fetchAllBusData()
        reconnectTimeout = setTimeout(connectWebSocket, 5000)
      }
    }

    // Initial connection
    connectWebSocket()

    return () => {
      if (ws) {
        ws.close()
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
    }
  }, [profile, user, allBuses, fetchAllBusData])

  const handleLogout = async () => {
    await logout()
  }

  const handleRefresh = () => {
    fetchAllBusData()
  }

  const getStatusColor = (status: DeviceStatus | null) => {
    if (!status) return "bg-gray-500"
    return status.ol === 1 ? "bg-green-500" : "bg-red-500"
  }

  const getStatusText = (status: DeviceStatus | null) => {
    if (!status) return "Unknown"
    return status.ol === 1 ? "Online" : "Offline"
  }

  // Fetch stops for a bus from Firestore (route), always use canonical busId
  const fetchStopsForBus = async (busId: string) => {
    if (!user) return;
    const firestoreService = new FirestoreService(user.uid);
    // Always use canonical busId (from Firestore, matched by plate number)
    const allAssignments = await firestoreService.getAllBusAssignments();
    const assignment = allAssignments.find((a) => a.busId === busId);
    if (assignment && assignment.routeId) {
      // Fetch route doc
      const routeDoc = await firestoreService.getRouteById(assignment.routeId);
      setBusStops((prev) => ({ ...prev, [busId]: routeDoc?.stops || [] }));
    } else {
      setBusStops((prev) => ({ ...prev, [busId]: [] }));
    }
  };

  // Add stop to Firestore for a bus, always use canonical busId
  const addStopToBus = async (busId: string, stop: StopInput) => {
    if (!user) return;
    try {
      const firestoreService = new FirestoreService(user.uid);
      // Always resolve canonical busId from buses collection
      const allBuses = await firestoreService.getAllBuses();
      // Try to match by busId or by plateNumber (case-insensitive, trimmed)
      let canonicalBus = allBuses.find(b => b.busId === busId);
      if (!canonicalBus) {
        // Try to match by plate number if busId is not canonical
        canonicalBus = allBuses.find(b => b.plateNumber && String(b.plateNumber).trim().toLowerCase() === String(busId).trim().toLowerCase());
      }
      const canonicalBusId = canonicalBus?.busId || busId;

      const assignments = await firestoreService.getAllBusAssignments();
      const assignment = assignments.find((a) => a.busId === canonicalBusId);
      let routeId = assignment?.routeId;
      let routeDoc = routeId ? await firestoreService.getRouteById(routeId) : null;
      let stops: any[] = [];
      if (routeDoc && routeId) {
        stops = routeDoc.stops || [];
        stops.push({
          name: stop.name,
          latitude: parseFloat(stop.latitude),
          longitude: parseFloat(stop.longitude),
          order: stops.length,
        });
        await firestoreService.updateRoute(routeId, { stops });
      } else {
        // Create new route for this bus, using canonical busId and plateNumber
        const newRoute = {
          name: `Route for ${assignment?.plateNumber || canonicalBus?.plateNumber || canonicalBusId}`,
          // driverId removed
          busId: canonicalBusId,
          plateNumber: assignment?.plateNumber || canonicalBus?.plateNumber || '',
          stops: [{
            name: stop.name,
            latitude: parseFloat(stop.latitude),
            longitude: parseFloat(stop.longitude),
            order: 0,
          }],
        };
        const newRouteId = await firestoreService.createRoute(newRoute);
        if (assignment && newRouteId) {
          await firestoreService.updateBusAssignment(assignment.id!, { routeId: newRouteId });
        } else if (newRouteId) {
          await firestoreService.createBusAssignment({
            busId: canonicalBusId,
            routeId: newRouteId,
            plateNumber: assignment?.plateNumber || canonicalBus?.plateNumber || '',
            // driverId removed
            isActive: true,
          });
        }
      }
      fetchStopsForBus(canonicalBusId);
      setNewStop((s) => ({ ...s, [canonicalBusId]: { name: "", latitude: "", longitude: "" } }));
    } catch (err) {
      alert('Failed to add stop: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Update bus information in Firestore
  const handleUpdateBus = async (busData: any) => {
    if (!user) return;
    try {
      const firestoreService = new FirestoreService(user.uid);
      
      // Update the bus document
      await firestoreService.updateBus(busData.busId, {
        plateNumber: busData.plateNumber,
        capacity: parseInt(busData.capacity) || 50,
        model: busData.model || '',
        year: parseInt(busData.year) || new Date().getFullYear(),
        notes: busData.notes || '',
      });

      // Refresh the bus data
      await fetchAllBusData();
      
      console.log(`✅ Bus ${busData.busId} updated successfully`);
    } catch (err) {
      console.error('Failed to update bus:', err);
      throw err;
    }
  };

  // Delete a bus and its related data
  const handleDeleteBus = async (busId: string) => {
    if (!user) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete bus ${busId}?\n\nThis will also delete:\n- All associated routes\n- All bus assignments\n- All stops\n\nThis action cannot be undone.`
    );
    
    if (!confirmDelete) return;

    try {
      const firestoreService = new FirestoreService(user.uid);
      
      // Get all bus assignments for this bus
      const assignments = await firestoreService.getAllBusAssignments();
      const busAssignments = assignments.filter((a) => a.busId === busId);
      
      // Delete all routes and assignments for this bus
      for (const assignment of busAssignments) {
        if (assignment.routeId) {
          await firestoreService.deleteRoute(assignment.routeId);
        }
        if (assignment.id) {
          await firestoreService.deleteBusAssignment(assignment.id);
        }
      }
      
      // Delete the bus itself
      await firestoreService.deleteBus(busId);
      
      // Refresh the bus data
      await fetchAllBusData();
      
      alert(`✅ Bus ${busId} and all related data deleted successfully`);
    } catch (err) {
      console.error('Failed to delete bus:', err);
      alert('❌ Failed to delete bus: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Delete a stop from Firestore for a bus, always use canonical busId
  const deleteStopFromBus = async (busId: string, stopIndex: number) => {
    if (!user) return;
    try {
      const firestoreService = new FirestoreService(user.uid);
      const assignments = await firestoreService.getAllBusAssignments();
      const assignment = assignments.find((a) => a.busId === busId);
      let routeId = assignment?.routeId;
      let routeDoc = routeId ? await firestoreService.getRouteById(routeId) : null;
      if (routeDoc && routeId) {
        let stops = routeDoc.stops || [];
        stops.splice(stopIndex, 1);
        stops = stops.map((s, i) => ({ ...s, order: i }));
        await firestoreService.updateRoute(routeId, { stops });
        fetchStopsForBus(busId);
      } else {
        alert('No route found to delete stop from.');
      }
    } catch (err) {
      alert('Failed to delete stop: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Helper to estimate time (in minutes) from bus to stop
  function estimateTimeToStop(busLat: number, busLng: number, stopLat: number, stopLng: number, speedKmh: number = 30) {
    const distanceMeters = haversine({ lat: busLat, lng: busLng }, { lat: stopLat, lng: stopLng });
    const speedMps = speedKmh * 1000 / 3600;
    const timeSeconds = distanceMeters / speedMps;
    return Math.round(timeSeconds / 60); // minutes
  }

  const handleAddBus = async () => {
    if (!user) return;
    if (!newBus.busId.trim()) {
      alert('Please enter a Device ID');
      return;
    }
    setAddingBus(true);
    try {
      const firestoreService = new FirestoreService(user.uid);
      const busData: any = {
        busId: newBus.busId.trim(),
        plateNumber: newBus.busId.trim(), // Use device ID as default plate
        capacity: 50, // Default capacity
        model: 'Manual Entry',
        notes: 'Manually added - waiting for GPS sync',
        createdAt: new Date().toISOString(),
        year: new Date().getFullYear(),
      };
      await firestoreService.addBus(busData);
      setAddBusModalOpen(false);
      setNewBus({ busId: '', plateNumber: '', capacity: '', model: '', year: '', notes: '' });
      fetchAllBusData();
      alert(`Bus with Device ID ${newBus.busId.trim()} added successfully!`);
    } catch (err) {
      alert('Failed to add bus: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAddingBus(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Access Error</CardTitle>
            <CardDescription>{error || "There was a problem loading your profile."}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Could not find an admin profile for your account. Please contact support.</p>
            <Button onClick={handleLogout}>Return to Login</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Official Government Header */}
      <header className="bg-white border-b-2 border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-3 rounded-lg">
                <Bus className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Administrator Dashboard
                </h1>
                <p className="text-sm text-gray-600">Fleet Management & Monitoring System</p>
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
                onClick={() => router.push('/admin/cameras')} 
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Activity className="h-4 w-4 mr-1" />
                Camera Feeds
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setAddBusModalOpen(true)} 
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                + Add Bus
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout} 
                className="border-gray-300 hover:bg-gray-50"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
        <div className="bg-gray-100 border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <span className="text-gray-700">
                  <strong>Administrator:</strong> {profile?.name || "User"}
                </span>
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
          <Alert variant="destructive" className="mb-6 border-2 border-red-300">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Section: Fleet Stats */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-blue-600" />
            Fleet Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-gray-300 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Total Buses</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{busDisplayData.length}</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Bus className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-gray-300 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Online Buses</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">
                      {busDisplayData.filter((b) => b.status.ol === 1).length}
                    </p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <Activity className="h-8 w-8 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-gray-300 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Routes Configured</p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">
                      {Object.keys(busStops).filter(busId => busStops[busId] && busStops[busId].length > 0).length}
                    </p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <MapPin className="h-8 w-8 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>



        {gpsAlert && (
          <Alert variant="destructive" className="mb-4 border-2 border-orange-300 bg-orange-50">
            <AlertDescription className="text-orange-900">{gpsAlert}</AlertDescription>
          </Alert>
        )}
        
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-white border border-gray-300">
            <TabsTrigger value="overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Fleet Cards</TabsTrigger>
            <TabsTrigger value="map" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">Live Map</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {busDisplayData.map((overview, idx) => {
                const canonicalBusIdRaw = overview.assignment?.busId || overview.status.vid;
                const canonicalBusId = typeof canonicalBusIdRaw === 'string' ? canonicalBusIdRaw : '';
                const stops = busStops[canonicalBusId] || [];
                // Find the bus data from Firestore for this device
                const busData = allBuses.find(b => b.busId === overview.status.id);
                return (
                  <FleetCard
                    key={overview.status.id}
                    overview={overview}
                    stops={stops}
                    newStop={newStop[canonicalBusId]}
                    setNewStop={(val: any) => setNewStop((s: any) => ({ ...s, [canonicalBusId]: val }))}
                    deleteStopFromBus={(stopIdx: number) => deleteStopFromBus(canonicalBusId, stopIdx)}
                    addStopToBus={(stop: any) => addStopToBus(canonicalBusId, stop)}
                    estimateTimeToStop={estimateTimeToStop}
                    sensors={sensors}
                    user={user}
                    onUpdateBus={handleUpdateBus}
                    onDeleteBus={handleDeleteBus}
                    busData={busData}
                  />
                );
              })}
            </div>

            {busDisplayData.length === 0 && !loading && (
              <Card className="border border-gray-300 shadow-sm">
                <CardContent className="text-center py-12">
                  <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bus className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">No buses found</h3>
                  <p className="text-gray-600">No bus data is currently available from the fleet service.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="map">
            <Card className="border border-gray-300 shadow-sm">
              <CardHeader className="bg-gray-50 border-b border-gray-200">
                <CardTitle className="flex items-center text-lg font-bold text-gray-900">
                  <MapPin className="h-5 w-5 mr-2 text-blue-600" />
                  All Buses Real-time Map
                </CardTitle>
                <CardDescription className="text-gray-600">Live locations of all buses in the fleet</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="mb-4 flex items-center gap-4">
                  <label className="font-semibold text-sm text-gray-700">Show route for bus:</label>
                  <select
                    className="border border-gray-300 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={selectedBusId ?? ''}
                    onChange={e => setSelectedBusId(e.target.value)}
                  >
                    {busIds.filter((id): id is string => !!id).map((id) => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                </div>
                <div className="h-96 rounded-lg overflow-hidden border-2 border-gray-300">
                  <GoogleMap
                    markers={(() => {
                      // Bus markers
                      const busMarkers = busDisplayData
                        .filter((b) => b.status.mlat && b.status.mlng)
                        .map((b) => ({
                          lat: parseFloat(b.status.mlat),
                          lng: parseFloat(b.status.mlng),
                          label: b.status.vid || undefined,
                          status: b.status.ol === 1 ? 'online' : 'offline',
                          type: 'bus',
                          busId: b.status.vid,
                        }));

                      // Show stops only for selected bus (by vid)
                      let stopMarkers: any[] = [];
                      let polylines: any[] = [];
                      if (selectedBusId && busStops[selectedBusId]) {
                        const bus = busMarkers.find(b => b.busId === selectedBusId);
                        const stops = busStops[selectedBusId] || [];
                        // Find the closest stop index that the bus has passed (by order, using haversine distance)
                        let passedIndex = -1;
                        if (bus && stops.length > 0) {
                          for (let i = 0; i < stops.length; i++) {
                            const dist = haversine(
                              { lat: bus.lat, lng: bus.lng },
                              { lat: stops[i].latitude, lng: stops[i].longitude }
                            );
                            if (dist < 50) passedIndex = i;
                          }
                        }
                        stops.forEach((stop, i) => {
                          stopMarkers.push({
                            lat: stop.latitude,
                            lng: stop.longitude,
                            label: `${i + 1}`,
                            status: i <= passedIndex ? 'passed' : 'notpassed',
                            type: 'stop',
                            busId: selectedBusId,
                          });
                        });
                        // Only show the road-following polyline if available
                        if (stops.length > 1 && roadPolyline && roadPolyline.length > 1) {
                          polylines.push({
                            type: 'polyline',
                            path: roadPolyline,
                          });
                        }
                      }

                      return [
                        ...busMarkers,
                        ...stopMarkers,
                        ...polylines,
                      ];
                    })()}
                    center={(() => {
                      // Get center based on selected bus
                      if (selectedBusId) {
                        const selectedBus = busDisplayData.find(b => b.status.vid === selectedBusId);
                        if (selectedBus && selectedBus.status.mlat && selectedBus.status.mlng) {
                          return {
                            lat: parseFloat(selectedBus.status.mlat),
                            lng: parseFloat(selectedBus.status.mlng)
                          };
                        }
                      }
                      return undefined;
                    })()}
                    height="100%"
                    showTrafficLayer={true}
                  />
                </div>
                <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs font-bold text-gray-900 mb-2">Map Legend</p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-green-500 rounded-full inline-block"></span>
                      Online
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-gray-400 rounded-full inline-block"></span>
                      Offline
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-green-500 rounded-full inline-block"></span>
                      Stop Passed
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-red-500 rounded-full inline-block"></span>
                      Stop Upcoming
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 bg-blue-600 inline-block"></span>
                      Route
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bus List */}
            <Card className="mt-4 border border-gray-300 shadow-sm">
              <CardHeader className="bg-gray-50 border-b border-gray-200">
                <CardTitle className="text-lg font-bold text-gray-900">All Buses</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  {busDisplayData
                    .filter((b) => b.status.mlat && b.status.mlng)
                    .map((overview) => (
                      <div key={overview.status.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${overview.status.ol === 1 ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                          <div>
                            <span className="font-semibold text-gray-900">{overview.status.vid}</span>
                            <p className="text-xs text-gray-600 font-mono">
                              {overview.status.mlat}, {overview.status.mlng}
                            </p>
                          </div>
                        </div>
                        <Badge variant={overview.status.ol === 1 ? "default" : "secondary"} className={overview.status.ol === 1 ? "bg-green-600" : "bg-gray-400"}>
                          {overview.status.ol === 1 ? "ONLINE" : "OFFLINE"}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Bus Modal */}
        <Dialog open={addBusModalOpen} onOpenChange={setAddBusModalOpen}>
          <DialogContent className="rounded-lg max-w-md mx-auto border-2 border-gray-300">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-900 flex items-center">
                <Bus className="h-5 w-5 mr-2 text-blue-600" />
                Add New Bus
              </DialogTitle>
              <p className="text-sm text-gray-600 mt-2">
                Enter the device ID and the bus will be added with default settings. GPS data will sync automatically when the device comes online.
              </p>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Device ID <span className="text-red-600">*</span></label>
                <input 
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                  placeholder="Enter device ID (e.g., 123456789)" 
                  value={newBus.busId} 
                  onChange={e => setNewBus(b => ({ ...b, busId: e.target.value }))}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-2">
                  Default settings: 50 seats capacity, current year, model "Manual Entry"
                </p>
              </div>
            </div>
            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button variant="outline" className="border-gray-300">Cancel</Button>
              </DialogClose>
              <Button 
                onClick={handleAddBus} 
                disabled={addingBus || !newBus.busId.trim()} 
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded"
              >
                {addingBus ? 'Adding...' : 'Add Bus'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      {/* Official Footer */}
      <footer className="bg-gray-800 text-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <h3 className="font-bold mb-2">About</h3>
              <p className="text-gray-400">School Transport Management System - An initiative for student safety and efficient fleet operations.</p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Support</h3>
              <p className="text-gray-400">For technical support, contact: support@globalschool.in</p>
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
