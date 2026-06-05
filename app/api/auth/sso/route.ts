import { NextRequest, NextResponse } from "next/server"
import { validateErpToken, createSessionCookie, isSsoConfigured } from "@/lib/sso"

export async function GET(request: NextRequest) {
  try {
    if (!isSsoConfigured()) {
      return NextResponse.json(
        { error: "SSO not configured. Set ERP_SSO_PUBLIC_KEY and SESSION_SECRET environment variables." },
        { status: 500 }
      )
    }

    const token = request.nextUrl.searchParams.get("token")
    if (!token) {
      return NextResponse.json(
        { error: "Missing token parameter. The ERP must provide a signed JWT as ?token=<jwt>" },
        { status: 400 }
      )
    }

    const user = await validateErpToken(token)

    await createSessionCookie(user)

    const redirectTarget = user.role === "admin" ? "/admin/dashboard" : "/parent/dashboard"

    return NextResponse.redirect(new URL(redirectTarget, request.url))
  } catch (error: any) {
    console.error("SSO authentication failed:", error)
    return NextResponse.json(
      {
        error: "SSO authentication failed",
        detail: error.message || "Invalid or expired token",
      },
      { status: 401 }
    )
  }
}
