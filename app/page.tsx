import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function HomePage() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      // OPTIMIZATION: Direct staff to Attendance page for faster check-in/check-out
      // Reduces friction and improves adoption
      redirect("/dashboard/attendance")
    } else {
      redirect("/auth/login")
    }
  } catch (error) {
    console.error("[v0] Error checking user auth:", error)
    // If there's an error, redirect to login
    redirect("/auth/login")
  }
}
