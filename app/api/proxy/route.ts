import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/proxy?url=<encoded_url>
 * Proxy requests to external APIs to avoid CORS issues
 */
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

    // Decode the URL
    const targetUrl = decodeURIComponent(url)

    // Make the request to the external API
    const response = await fetch(targetUrl)
    const data = await response.json()

    // Return the data with appropriate headers
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
