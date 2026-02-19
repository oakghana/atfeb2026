import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[v0] Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllOffPremises() {
  console.log('[v0] Checking all off-premises requests...\n');

  // Query all records from pending_offpremises_checkins
  const { data, error } = await supabase
    .from('pending_offpremises_checkins')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[v0] Error querying database:', error.message);
    return;
  }

  console.log(`[v0] Total records in pending_offpremises_checkins: ${data?.length || 0}`);
  console.log('[v0] Last 10 records:');
  
  if (data && data.length > 0) {
    data.slice(0, 10).forEach((record, index) => {
      console.log(`\n[v0] Record ${index + 1}:`);
      console.log(`  ID: ${record.id}`);
      console.log(`  User ID: ${record.user_id}`);
      console.log(`  Created At: ${record.created_at}`);
      console.log(`  Status: ${record.status || 'N/A'}`);
      console.log(`  Reason: ${record.reason || 'N/A'}`);
    });
  } else {
    console.log('[v0] No records found in the table');
  }

  // Now check today's date specifically
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.toISOString();
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayEnd = tomorrow.toISOString();

  console.log(`\n[v0] Checking for records between ${todayStart} and ${todayEnd}`);

  const { data: todayData, error: todayError } = await supabase
    .from('pending_offpremises_checkins')
    .select('*')
    .gte('created_at', todayStart)
    .lt('created_at', todayEnd);

  if (todayError) {
    console.error('[v0] Error querying today\'s data:', todayError.message);
    return;
  }

  console.log(`[v0] Records created today: ${todayData?.length || 0}`);
  
  if (todayData && todayData.length > 0) {
    todayData.forEach((record, index) => {
      console.log(`\n[v0] Today's Record ${index + 1}:`);
      console.log(`  ID: ${record.id}`);
      console.log(`  User ID: ${record.user_id}`);
      console.log(`  Created At: ${record.created_at}`);
    });
  }
}

checkAllOffPremises().catch(console.error);
