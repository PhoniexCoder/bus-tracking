import { type NextRequest, NextResponse } from "next/server"
import { fleetBackend, type DeviceIdentifier } from "@/lib/fleet-backend"
import { AdminFirestoreService } from "@/lib/firebase-admin"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const adminFirestoreService = new AdminFirestoreService()


    // Get vehicle devices directly from getDeviceByVehicle endpoint
    // Get devices using valid vehicle ID format
    const devices: DeviceIdentifier[] = await fleetBackend.getDeviceByVehicle("all");


    // Group devices by vehicle ID with proper typing
    const vehiclesMap = devices.reduce((acc: Record<string, any>, device: DeviceIdentifier) => {
      if (!acc[device.vid]) {
        acc[device.vid] = {
          id: device.vid,
          nm: device.vid,
          dl: [],
          pnm: "Unknown Company"
        };
      }
      acc[device.vid].dl.push({
        id: device.did,
        pid: 0,
        ic: 0,
        io: "in",
        cc: 0,
        cn: "Unknown",
        tc: 0,
        tn: "Unknown",
        md: 0,
        sim: null
      });
      return acc;
    }, {} as Record<string, any>);

    // Convert devices to DeviceStatus format for cache (with safe defaults)
    const deviceStatuses = devices
      .map(device => ({
        id: (device as any)?.did || (device as any)?.dev_idno || "",
        vid: (device as any)?.vid || (device as any)?.vehi_idno || "",
        lng: 0,
        lat: 0,
        mlng: "0",
        mlat: "0",
        gt: new Date().toISOString(),
        ol: 1,
        ps: "",
        dn: null,
        jn: null
      }))
      // Filter out any entries that ended up without an id
      .filter(s => s.id)

    // Update cache with transformed device statuses (non-blocking)
    adminFirestoreService.setCachedDeviceStatuses(deviceStatuses).catch((e) => {
      console.error("Failed to cache device statuses:", e?.message || e)
    });

    return NextResponse.json({
      success: true,
      data: Object.values(vehiclesMap),
      timestamp: new Date().toISOString(),
      source: "api"
    })
  } catch (error: any) {
    console.error("Fleet vehicles API error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch vehicles",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
