import { createClient } from '@supabase/supabase-js';

async function checkUserRoles() {
  console.log("[v0] Checking all user roles in system...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get all users with their profiles
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, email, role, position')
      .order('created_at', { ascending: false });

    console.log(`[v0] Total users in system: ${users?.length || 0}`);
    
    if (users) {
      console.log("\n[v0] Users and their roles:");
      users.forEach((u, idx) => {
        console.log(`[v0] ${idx + 1}. ${u.first_name} ${u.last_name} (${u.email}) - Role: ${u.role} - Position: ${u.position}`);
      });

      // Find the current user (Jonathan Yankey - from earlier investigation)
      const currentUser = users.find(u => u.email === 'jonathan.yankey@qccgh.com');
      if (currentUser) {
        console.log(`\n[v0] CURRENT USER: ${currentUser.first_name} ${currentUser.last_name}`);
        console.log(`[v0] Email: ${currentUser.email}`);
        console.log(`[v0] Role: ${currentUser.role}`);
        console.log(`[v0] Is Manager? ${["department_head", "regional_manager", "admin"].includes(currentUser.role)}`);
        console.log(`[v0] ISSUE: User needs one of these roles to view pending requests: department_head, regional_manager, admin`);
      }
    }

  } catch (error) {
    console.error("[v0] Exception:", error);
  }
}

checkUserRoles();
