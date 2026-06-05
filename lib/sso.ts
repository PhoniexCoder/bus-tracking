import { importSPKI, jwtVerify, SignJWT } from "jose"
import { cookies } from "next/headers"

const ERP_PUBLIC_KEY = process.env.ERP_SSO_PUBLIC_KEY || ""
const SESSION_SECRET = process.env.SESSION_SECRET || ""
const SESSION_COOKIE_NAME = "bus_session"
const SESSION_DURATION = 24 * 60 * 60 * 1000

export interface SsoUser {
  sub: string
  role: "admin" | "parent" | "student"
  email?: string
  name?: string
}

export function isSsoConfigured(): boolean {
  return !!(ERP_PUBLIC_KEY && SESSION_SECRET)
}

export async function validateErpToken(token: string): Promise<SsoUser> {
  if (!ERP_PUBLIC_KEY) {
    throw new Error("ERP_SSO_PUBLIC_KEY not configured")
  }

  const publicKey = await importSPKI(ERP_PUBLIC_KEY, "RS256")

  const { payload } = await jwtVerify(token, publicKey, {
    issuer: "erp",
    audience: "bus-tracking",
  })

  if (!payload.sub || !payload.role) {
    throw new Error("Invalid ERP token: missing sub or role")
  }

  const role = payload.role as string
  if (!["admin", "parent", "student"].includes(role)) {
    throw new Error(`Invalid ERP token: unknown role "${role}"`)
  }

  return {
    sub: payload.sub as string,
    role: role as "admin" | "parent" | "student",
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
  }
}

export async function createSessionCookie(user: SsoUser): Promise<void> {
  if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET not configured")
  }

  const secret = new TextEncoder().encode(SESSION_SECRET.padEnd(32, "x").slice(0, 32))
  const expiresAt = Date.now() + SESSION_DURATION

  const sessionToken = await new SignJWT({ ...user, exp: Math.floor(expiresAt / 1000) })
    .setProtectedHeader({ alg: "HS256" })
    .sign(secret)

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION / 1000,
    path: "/",
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  })
}

export async function getSessionUser(): Promise<SsoUser | null> {
  if (!SESSION_SECRET) return null

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return null

  try {
    const secret = new TextEncoder().encode(SESSION_SECRET.padEnd(32, "x").slice(0, 32))
    const { payload } = await jwtVerify(sessionCookie.value, secret, {
      algorithms: ["HS256"],
    })

    return {
      sub: payload.sub as string,
      role: payload.role as "admin" | "parent" | "student",
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
    }
  } catch {
    return null
  }
}
