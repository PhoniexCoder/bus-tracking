import { NextRequest, NextResponse } from "next/server"

const ALLOWED_DOMAINS = (process.env.PROXY_ALLOWED_DOMAINS || "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean)

function isDomainAllowed(url: string): boolean {
  if (ALLOWED_DOMAINS.length === 0 && process.env.NODE_ENV !== "development") {
    return false
  }

  if (ALLOWED_DOMAINS.length === 0) {
    return true
  }

  try {
    const parsed = new URL(url)
    return ALLOWED_DOMAINS.some(
      (allowed) => parsed.hostname === allowed || parsed.hostname.endsWith("." + allowed)
    )
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get("url")

    if (!url) {
      return NextResponse.json(
        { error: "URL parameter is required" },
        { status: 400 }
      )
    }

    const targetUrl = decodeURIComponent(url)

    if (!isDomainAllowed(targetUrl)) {
      return NextResponse.json(
        { error: "Proxying to this domain is not allowed. Configure PROXY_ALLOWED_DOMAINS environment variable." },
        { status: 403 }
      )
    }

    const response = await fetch(targetUrl)
    const data = await response.json()

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    })
  } catch (error) {
    console.error("Proxy error:", error)
    return NextResponse.json(
      { error: "Failed to fetch data from external API" },
      { status: 500 }
    )
  }
}
