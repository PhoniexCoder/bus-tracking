import { redirect } from "next/navigation"

export default function StudentLoginRedirect() {
  // Redirect old student login path to unified login with role preselected
  redirect("/login?role=student")
}
