import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { SettingsClient } from "@/components/settings/settings-client"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, role, first_name, last_name")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    redirect("/dashboard?error=access_denied")
  }

  // Fetch system settings
  const { data: systemSettings } = await supabase.from("system_settings").select("*").single()

  // Prepare initialSettings object with both profile and settings data
  const initialSettings = {
    profile,
    ...systemSettings,
  }

  return (
    <DashboardLayout>
      <SettingsClient initialSettings={initialSettings} />
    </DashboardLayout>
  )
}
