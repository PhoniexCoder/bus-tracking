import { type NextRequest, NextResponse } from "next/server"
import { fleetBackend } from "@/lib/fleet-backend"

export async function GET(request: NextRequest) {
  try {
    const sessionInfo = fleetBackend.getSessionInfo()

    return NextResponse.json({
      success: true,
      data: {
        hasSession: !!sessionInfo,
        sessionInfo: sessionInfo
          ? {
              expiresAt: sessionInfo.expiresAt,
              createdAt: sessionInfo.createdAt,
              isValid: sessionInfo.expiresAt > new Date(),
            }
          : null,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Fleet session info API error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to get session info",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
