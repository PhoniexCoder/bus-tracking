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
import { CSS, useCombinedRefs } from '@dnd-kit/utilities';
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
import type { DeviceStatus } from "@/lib/fleet-types";
import { Button } from "@/components/ui/button"
import { signInAnonymously } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, Users, Bus, RefreshCw, Activity, Clock, Settings, LogOut } from "lucide-react"
import { GoogleMap } from "@/components/google-map"
import { StatsOverlay } from "./components/StatsOverlay"
import { FleetDrawer } from "./components/FleetDrawer"
import { BusManagementDialog } from "./components/BusManagementDialog"
import { MapLegend } from "./components/MapLegend" // 1. Import Dialog
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
  const { user } = useAuth()
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [busDisplayData, setBusDisplayData] = useState<BusDisplayData[]>([])
  const [assignments, setAssignments] = useState<BusAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [allBuses, setAllBuses] = useState<any[]>([]) // Store all buses from Firestore
  const [wsConnected, setWsConnected] = useState(false) // WebSocket connection status
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check for backend auth
  // Check for backend auth
  useEffect(() => {
    // If we have a firebase user, we are good
    if (user) {
      setIsAuthenticated(true)
      return
    }

    // Otherwise check for local token
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('admin_token')
      if (token) {
        setIsAuthenticated(true)
        // Ensure profile is set immediately to avoid "Access Error"
        setProfile((prev) => prev || { username: 'admin', name: 'Administrator', createdAt: {} as any } as any)

        // Critical: Sign in anonymously to pass Firestore Security Rules
        if (!user) {
          signInAnonymously(auth).catch(err => console.error("Anon auth failed", err));
        }

      } else {
        // No auth at all -> Redirect
        router.push('/admin/login')
      }
    }
  }, [user, router])


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
    erpId: '',
  });
  const [addingBus, setAddingBus] = useState(false);

  // Bus Management Dialog State
  const [managingBusId, setManagingBusId] = useState<string | null>(null);

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
        try { bodyText = await res.text(); } catch { }
        throw new Error(`Failed to fetch bus info from FastAPI (status ${res.status}) ${bodyText ? `- ${bodyText}` : ""}`)
      }
      const liveList = await res.json()

      // Fetch assignments and buses from Firestore
      let allAssignments: BusAssignment[] = [];
      let allBuses: any[] = [];
      const uid = user?.uid || 'admin-internal';
      if (uid) {
        const firestoreService = new FirestoreService(uid);
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
                  erpId: '',
                  createdAt: new Date().toISOString(),
                };

                await firestoreService.addBus(newBusData);
                allBuses.push(newBusData);
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

  // Initial data wiping effect removed to prevent race condition with backend auth

  useEffect(() => {
    if (isAuthenticated) {
      // Must wait for anon auth to complete if we are using Firebase
      if (!user) {
        return
      }

      fetchAllBusData()

      // Init profile dummy for internal admin if not already set
      if (!user) {
        setProfile((prev) => prev || { username: 'admin', name: 'Administrator', createdAt: {} as any } as any)
      }
      setLoading(false)
    }
  }, [user, fetchAllBusData, isAuthenticated])

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!isAuthenticated) return

    let ws: WebSocket | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null

    const connectWebSocket = () => {
      try {
        const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || 'ws://localhost:8000'
        ws = new WebSocket(`${wsUrl}/ws/live`)

        ws.onopen = () => {
          setWsConnected(true)
          setError("")
        }

        ws.onmessage = async (event) => {
          try {
            const liveList = JSON.parse(event.data)

            // Fetch assignments and buses from Firestore if needed
            const uid = user?.uid || 'admin-internal';
            const firestoreService = new FirestoreService(uid)
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
          setWsConnected(false)
        }

        ws.onclose = (event) => {
          setWsConnected(false)

          // Fallback to HTTP polling if WebSocket fails
          if (busDisplayData.length === 0) {
            fetchAllBusData()
          }

          reconnectTimeout = setTimeout(() => {
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
  }, [isAuthenticated])

  // Logout function
  const handleLogout = () => {
    // Optionally clear any local state/tokens if needed
    router.push('/admin/login')
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
    const uid = user?.uid || 'admin-internal';
    const firestoreService = new FirestoreService(uid);
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
    const uid = user?.uid || 'admin-internal';
    try {
      const firestoreService = new FirestoreService(uid);
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
    const uid = user?.uid || 'admin-internal';
    try {
      const firestoreService = new FirestoreService(uid);

      // Update the bus document
      await firestoreService.updateBus(busData.busId, {
        plateNumber: busData.plateNumber,
        capacity: parseInt(busData.capacity) || 50,
        model: busData.model || '',
        year: parseInt(busData.year) || new Date().getFullYear(),
        notes: busData.notes || '',
        erpId: busData.erpId || '',
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
    // Auth check handled by page

    const confirmDelete = window.confirm(
      `Are you sure you want to delete bus ${busId}?\n\nThis will also delete:\n- All associated routes\n- All bus assignments\n- All stops\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      const uid = user?.uid || 'admin-internal';
      const firestoreService = new FirestoreService(uid);

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
    const uid = user?.uid || 'admin-internal';
    try {
      const firestoreService = new FirestoreService(uid);
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
    const uid = user?.uid || 'admin-internal';
    if (!newBus.busId.trim()) {
      alert('Please enter a Device ID');
      return;
    }
    setAddingBus(true);
    try {
      const firestoreService = new FirestoreService(uid);
      const busData: any = {
        busId: newBus.busId.trim(),
        plateNumber: newBus.busId.trim(), // Use device ID as default plate
        capacity: 50, // Default capacity
        model: 'Manual Entry',
        notes: 'Manually added - waiting for GPS sync',
        erpId: newBus.erpId || '',
        createdAt: new Date().toISOString(),
        year: new Date().getFullYear(),
      };
      await firestoreService.addBus(busData);
      setAddBusModalOpen(false);
      setNewBus({ busId: '', plateNumber: '', capacity: '', model: '', year: '', notes: '', erpId: '' });
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
            {/* Fallback to just showing the content if we have a token but profile is flaky */}
            <CardDescription>{error || "Loading profile..."}</CardDescription>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              Retry
            </Button>
            <Button variant="link" className="mt-2 text-red-500" onClick={handleLogout}>
              Return to Login
            </Button>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100">

      {/* 1. Stats Overlay (Top) */}
      <StatsOverlay
        totalBuses={busDisplayData.length}
        onlineBuses={busDisplayData.filter(b => b.status.ol === 1).length}
        activeRoutes={Object.keys(busStops).length}
        alerts={gpsAlert ? 1 : 0}
      />

      {/* 2. Fleet Drawer (Side) */}
      <FleetDrawer
        buses={busDisplayData}
        onSelectBus={(id) => setSelectedBusId(id)}
        onManageBus={(id) => setManagingBusId(id)}
        selectedBusId={selectedBusId}
      />

      {/* 3. Main Map (Background) */}
      <div className="absolute inset-0 z-0">
        <GoogleMap
          height="100vh"
          width="100vw"
          markers={(() => {
            // Bus markers
            const busMarkers = busDisplayData
              .filter((b) => b.status.mlat && b.status.mlng)
              .map((b) => ({
                lat: parseFloat(b.status.mlat),
                lng: parseFloat(b.status.mlng),
                label: b.plate_number || b.status.vid || undefined,
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
              // Find the closest stop index that the bus has passed
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
          showTrafficLayer={true}
        />
      </div>

      {/* 4. Floating Action Buttons (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-3">
        <Button
          size="icon"
          className="rounded-full h-12 w-12 bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20"
          onClick={() => setAddBusModalOpen(true)}
          title="Add Bus"
        >
          <Bus className="h-6 w-6 text-white" />
        </Button>
        <Button
          size="icon"
          className="rounded-full h-12 w-12 bg-red-900/80 hover:bg-red-800 border border-red-800 text-red-300"
          onClick={handleLogout}
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      {/* 5. Notifications/Alerts Toast (Bottom Center) */}
      {gpsAlert && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
          <div className="bg-red-500/90 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium backdrop-blur-sm">
            <Activity className="w-4 h-4 animate-bounce" />
            {gpsAlert}
          </div>
        </div>
      )}

      {/* 6. Map Legend (Bottom Left) */}
      <MapLegend />

      {/* Modals */}
      <Dialog open={addBusModalOpen} onOpenChange={setAddBusModalOpen}>
        <DialogContent className="rounded-lg max-w-md mx-auto border border-slate-700 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center text-white">
              <Bus className="h-5 w-5 mr-2 text-blue-500" />
              Add New Bus
            </DialogTitle>
            <p className="text-sm text-slate-400 mt-2">
              Enter the device ID. The system will auto-configure it.
            </p>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">Device ID <span className="text-red-500">*</span></label>
              <input
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-base text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none placeholder:text-slate-600"
                placeholder="e.g., 123456789"
                value={newBus.busId}
                onChange={e => setNewBus(b => ({ ...b, busId: e.target.value }))}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleAddBus}
              disabled={addingBus || !newBus.busId.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {addingBus ? 'Adding...' : 'Add Bus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bus Management Dialog */}
      {managingBusId && (
        <BusManagementDialog
          isOpen={!!managingBusId}
          onClose={() => setManagingBusId(null)}
          bus={busDisplayData.find(b => b.status.vid === managingBusId)}
          stops={busStops[managingBusId] || []}
          onUpdateBus={handleUpdateBus}
          onDeleteBus={handleDeleteBus}
          addStopToBus={(stop) => addStopToBus(managingBusId, stop)}
          deleteStopFromBus={(idx) => deleteStopFromBus(managingBusId, idx)}
          estimateTimeToStop={estimateTimeToStop}
        />
      )}
    </div>
  )
}

