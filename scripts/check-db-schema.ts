import { createClient } from '@supabase/supabase-js';

async function checkSchema() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check what columns exist in user_profiles
    console.log("[v0] Checking user_profiles table...");
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(1);
    
    if (userProfiles && userProfiles.length > 0) {
      console.log("[v0] user_profiles columns:", Object.keys(userProfiles[0]));
    }

    // Check what tables exist
    console.log("\n[v0] Checking available tables...");
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (tables) {
      const locationTables = tables.filter(t => 
        t.table_name.includes('location') || 
        t.table_name.includes('geofence')
      );
      console.log("[v0] Location-related tables:", locationTables.map(t => t.table_name));
    }

    // Test the correct query with geofence_locations
    console.log("\n[v0] Testing query with geofence_locations...");
    const { data: test, error: testError } = await supabase
      .from('pending_offpremises_checkins')
      .select(`
        id,
        user_id,
        reason,
        google_maps_name,
        created_at,
        user_profiles!pending_offpremises_checkins_user_id_fkey (
          id,
          first_name,
          last_name,
          assigned_location_id,
          geofence_locations (
            id,
            name
          )
        )
      `)
      .limit(1);
    
    if (testError) {
      console.error("[v0] Query error:", testError);
    } else {
      console.log("[v0] Query succeeded! Data:", JSON.stringify(test, null, 2));
    }

  } catch (error) {
    console.error("[v0] Exception:", error);
  }
}

checkSchema();
