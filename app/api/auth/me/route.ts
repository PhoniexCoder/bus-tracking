import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/sso"

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 })
    }
    return NextResponse.json({ user })
  } catch (error) {
    console.error("Failed to get session user:", error)
    return NextResponse.json({ user: null }, { status: 200 })
  }
}
