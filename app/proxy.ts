import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const protectedApiPaths = ["/api/proxy"]
const protectedPagePaths: Record<string, string> = {
  "/admin/dashboard": "/login?role=admin",
  "/admin/cameras": "/login?role=admin",
  "/admin/backend-test": "/login?role=admin",
  "/parent/dashboard": "/login?role=student",
}

function buildCsp(): string {
  const customCsp = process.env.CSP_HEADER
  if (customCsp) return customCsp

  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "*.firebaseapp.com"
  const storageDomain = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "*.firebasestorage.app"
  const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL
  const wsOrigin = wsUrl ? wsUrl.replace(/^ws(s?):\/\//, "https$1://") : ""

  const connectSrc = [
    "'self'",
    "https://maps.googleapis.com",
    `https://${authDomain}`,
    `https://${storageDomain}`,
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://firestore.googleapis.com",
    wsOrigin,
  ]
    .filter(Boolean)
    .join(" ")

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://maps.gstatic.com",
    "img-src 'self' data: blob: https://maps.gstatic.com https://maps.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    "frame-src 'self' https://accounts.google.com",
    "media-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join("; ")
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const response = NextResponse.next()

  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set("X-DNS-Prefetch-Control", "off")
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), interest-cohort=()")

  const csp = buildCsp()
  response.headers.set("Content-Security-Policy", csp)

  const isProduction = process.env.NODE_ENV === "production"
  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    )
  }

  if (protectedApiPaths.some((path) => pathname.startsWith(path))) {
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required. Provide a Bearer token in the Authorization header." },
        { status: 401 }
      )
    }
  }

  for (const [pagePath, redirectUrl] of Object.entries(protectedPagePaths)) {
    if (pathname.startsWith(pagePath)) {
      const sessionCookie = request.cookies.get("bus_session")
      if (!sessionCookie?.value) {
        return NextResponse.redirect(new URL(redirectUrl, request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.ts|api/auth|api/health).*)",
  ],
}
