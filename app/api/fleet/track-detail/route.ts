import { type NextRequest, NextResponse } from "next/server"
import { fleetBackend } from "@/lib/fleet-backend"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const devIdno = searchParams.get("devIdno")
    const begintime = searchParams.get("begintime")
    const endtime = searchParams.get("endtime")

    if (!devIdno || !begintime || !endtime) {
      return NextResponse.json({ success: false, error: "devIdno, begintime, and endtime are required" }, { status: 400 })
    }

    const tracks = await fleetBackend.queryTrackDetail(devIdno, begintime, endtime)

    return NextResponse.json({
      success: true,
      data: tracks,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Fleet queryTrackDetail API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch track details",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

