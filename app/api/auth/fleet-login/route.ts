import { NextResponse } from "next/server"

// Authentication disabled: endpoint removed
export async function POST() {
  return NextResponse.json({ error: "Authentication disabled" }, { status: 410 })
}
