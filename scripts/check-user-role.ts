import { createClient, createAdminClient } from "@/lib/supabase/server"

async function checkUserRole() {
  console.log("[v0] Checking user role...")
  
  const supabase = await createClient()
  const adminClient = await createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  console.log("[v0] Auth user:", user?.id, user?.email)

  if (user?.id) {
    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("id, first_name, last_name, role, email, department_id")
      .eq("id", user.id)
      .maybeSingle()

    console.log("[v0] User profile:", profile)
    
    if (profile) {
      console.log("[v0] User role:", profile.role)
      console.log("[v0] Is manager?", ["department_head", "regional_manager", "admin"].includes(profile.role))
    }
  }
}

checkUserRole()
