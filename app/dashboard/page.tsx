import { redirect } from "next/navigation"

export default async function DashboardPage() {
  // OPTIMIZATION: Direct all users accessing /dashboard to /dashboard/attendance
  // This ensures Attendance is always the landing page, not Dashboard
  redirect("/dashboard/attendance")
}
