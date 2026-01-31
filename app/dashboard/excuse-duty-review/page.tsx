import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ExcuseDutyReviewClient } from "@/components/admin/excuse-duty-review-client"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"

export default async function ExcuseDutyReviewPage() {
  const supabase = await createClient()

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/auth/login")
  }

  // Get user profile to check role
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("role, department_id, first_name, last_name")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    redirect("/dashboard")
  }

  // Check if user has admin, regional_manager, or department_head role
  if (!["admin", "regional_manager", "department_head"].includes(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Excuse Duty Review</h1>
          <p className="text-muted-foreground">
            {profile.role === "admin"
              ? "Review and approve excuse duty submissions from all departments"
              : "Review and approve excuse duty submissions from your department"}
          </p>
        </div>

        <ExcuseDutyReviewClient userRole={profile.role} userDepartment={profile.department_id} />
      </div>
    </DashboardLayout>
  )
}
