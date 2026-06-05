import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8000"
const USERNAME = process.env.BACKEND_API_USERNAME
const PASSWORD = process.env.BACKEND_API_PASSWORD

let cachedToken: string | null = null
let tokenExpiry = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken

  if (!USERNAME || !PASSWORD) {
    throw new Error(
      "Backend API credentials not configured. Set BACKEND_API_USERNAME and BACKEND_API_PASSWORD environment variables."
    )
  }

  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Backend login failed: ${res.status} - ${text}`)
  }

  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + 25 * 60 * 1000
  return cachedToken!
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params
    const path = pathSegments.join("/")
    const qs = request.nextUrl.searchParams.toString()
    const url = `${BACKEND_URL}/${path}${qs ? `?${qs}` : ""}`

    const token = await getToken()

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    const body = await response.text()

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Cache-Control": "no-store",
      },
    })
  } catch (error: any) {
    console.error("Fleet API proxy error:", error)
    return NextResponse.json(
      { error: error.message || "Fleet API proxy failed" },
      { status: 500 }
    )
  }
}
