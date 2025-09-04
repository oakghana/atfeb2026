import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { ProfileClient } from "@/components/profile/profile-client"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <DashboardLayout>
      <ProfileClient />
    </DashboardLayout>
  )
}
