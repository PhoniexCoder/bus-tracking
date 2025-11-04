import { type NextRequest, NextResponse } from "next/server"
import { fleetBackend } from "@/lib/fleet-backend"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const devIdno = searchParams.get("devIdno")
    const toMap = searchParams.get("toMap") === "true"

    const deviceStatus = await fleetBackend.getDeviceStatus(devIdno || undefined, toMap)

    return NextResponse.json({
      success: true,
      data: deviceStatus,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Fleet device status API error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch device status",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
