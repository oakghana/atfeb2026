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

  // Fetch user profile on server side
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, role, first_name, last_name")
    .eq("id", user.id)
    .single()

  return (
    <DashboardLayout>
      <SettingsClient profile={profile} />
    </DashboardLayout>
  )
}
