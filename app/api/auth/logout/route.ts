import { NextResponse } from "next/server"
import { clearSessionCookie } from "@/lib/sso"

export async function POST() {
  try {
    await clearSessionCookie()

    return NextResponse.json({ success: true, message: "Logged out successfully" })
  } catch (error) {
    console.error("Logout API error:", error)
    return NextResponse.json({ success: false, error: "Failed to log out" }, { status: 500 })
  }
}
