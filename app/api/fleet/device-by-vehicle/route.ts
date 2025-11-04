import { type NextRequest, NextResponse } from "next/server"
import { fleetBackend } from "@/lib/fleet-backend"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const vehiIdno = searchParams.get("vehiIdno")

    if (!vehiIdno) {
      return NextResponse.json({ success: false, error: "vehiIdno query parameter is required" }, { status: 400 })
    }

    const devices = await fleetBackend.getDeviceByVehicle(vehiIdno)

    return NextResponse.json({
      success: true,
      data: devices,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Fleet getDeviceByVehicle API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch device identifiers",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

