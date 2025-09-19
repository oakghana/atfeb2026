import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { StaffManagement } from "@/components/admin/staff-management"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function StaffPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

  if (!profile || profile.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-primary tracking-tight">Staff Management</h1>
          <p className="text-lg text-muted-foreground">Manage QCC staff members, roles, and permissions</p>
        </div>

        <StaffManagement />
      </div>
    </DashboardLayout>
  )
}
