import { NextRequest, NextResponse } from "next/server"

// Minimal mock user store mapping to student records
const MOCK_USERS = {
  parent1: { password: "test123", studentId: "S001" },
  parent2: { password: "test123", studentId: "S002" },
} as const

const MOCK_STUDENTS = {
  S001: { studentId: "S001", name: "Aarav Sharma", class: "5", section: "A" },
  S002: { studentId: "S002", name: "Anaya Patel", class: "4", section: "B" },
} as const

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body || {}

    if (!username || !password) {
      return NextResponse.json({ error: "username and password are required" }, { status: 400 })
    }

    const user = (MOCK_USERS as Record<string, any>)[username]
    if (!user || user.password !== password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const student = (MOCK_STUDENTS as Record<string, any>)[user.studentId]

    // Simulate issuing a simple session token (non-secure, for mock only)
    const token = `mock-${username}-${Date.now()}`

    return NextResponse.json(
      {
        token,
        student,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (e) {
    console.error("Mock ERP login error:", e)
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
