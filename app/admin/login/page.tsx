import { redirect } from "next/navigation"

// Redirect legacy /admin/login to the unified login page with admin role
export default function AdminLoginRedirect() {
  redirect("/login?role=admin")
}
