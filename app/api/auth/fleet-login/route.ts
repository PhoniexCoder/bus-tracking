import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/auth/fleet-login
 * Authenticates parent users via Fleet API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      )
    }

    // Validate credentials against Fleet API
    // For now, we'll do a simple validation
    // In production, you should validate against your actual Fleet API
    
    // Example: Check if username exists and password is valid
    // This is a placeholder - replace with actual Fleet API authentication
    const fleetApiUrl = "https://fleet.lagaam.in/StandardApiAction_login.action"
    
    const response = await fetch(fleetApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        account: username,
        password: password,
      }),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    const data = await response.json()
    
    // Check if login was successful
    if (data.result === 0 || data.jsession) {
      return NextResponse.json(
        { 
          success: true,
          message: "Login successful",
          jsession: data.jsession 
        },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error("Fleet login error:", error)
    return NextResponse.json(
      { error: "An error occurred during login" },
      { status: 500 }
    )
  }
}
