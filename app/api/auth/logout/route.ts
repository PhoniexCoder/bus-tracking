import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST() {
  try {
    // Clear the session cookie by setting its value to empty and maxAge to 0.
    // This is the standard way to remove a cookie.
    cookies().set("__session", "", { maxAge: 0 })

    return NextResponse.json({ success: true, message: "Logged out successfully" })
  } catch (error) {
    console.error("Logout API error:", error)
    return NextResponse.json({ success: false, error: "Failed to log out" }, { status: 500 })
  }
}
