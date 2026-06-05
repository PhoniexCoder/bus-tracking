import { NextResponse } from "next/server"
import { adminAuth } from "@/lib/firebase-admin"

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 403 })
  }

  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "example.com"
  const results: { email: string; password: string; role: string; status: string }[] = []

  const users = [
    { username: "parent", password: "parent123", role: "parent" },
    { username: "student1", password: "student123", role: "parent" },
  ]

  for (const { username, password, role } of users) {
    const email = `${username}@${authDomain}`
    try {
      await adminAuth.createUser({ email, password, displayName: username })
      results.push({ email, password, role, status: "created" })
    } catch (err: any) {
      if (err.code === "auth/email-already-exists") {
        results.push({ email, password, role, status: "already exists" })
      } else {
        results.push({ email, password, role, status: `error: ${err.message}` })
      }
    }
  }

  return NextResponse.json({ message: "Seed complete", users: results })
}
