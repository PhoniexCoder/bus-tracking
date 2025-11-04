import { redirect } from "next/navigation"

export default function DriverLoginRedirect() {
  // Driver role removed; redirect to student login by default
  redirect("/login?role=student")
}
