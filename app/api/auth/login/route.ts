import { NextRequest, NextResponse } from "next/server"
import { createSessionCookie } from "@/lib/sso"
import { adminAuth } from "@/lib/firebase-admin"

export async function POST(request: NextRequest) {
  try {
    const { idToken, role } = await request.json()

    if (!idToken || !role) {
      return NextResponse.json({ error: "Missing idToken or role" }, { status: 400 })
    }

    if (!["admin", "parent", "student"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken)

    await createSessionCookie({
      sub: decodedToken.uid,
      role: role as "admin" | "parent" | "student",
      email: decodedToken.email || undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Login API error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 })
  }
}