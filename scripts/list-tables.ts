import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vgtajtqxgczhjboatvol.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndGFqdHF4Z2N6aGpib2F0dm9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Njk3NTI0OCwiZXhwIjoyMDcyNTUxMjQ4fQ.x3by0hGUAO3GQcPs1_sla6gdGY8QuxcYiGmSRdj4-yA';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listTables() {
  try {
    console.log('Listing all tables in the database...\n');

    // Try to list tables related to offpremises or attendance
    const { data: offPremisesData, error: offError } = await supabase
      .from('pending_offpremises_checkins')
      .select('*', { count: 'exact', head: true });

    const { data: allCheckinsData, error: allError } = await supabase
      .from('all_offpremises_checkins')
      .select('*', { count: 'exact', head: true });

    console.log('Table: pending_offpremises_checkins');
    if (offError) {
      console.log(`  Error: ${offError.message}`);
    } else {
      console.log('  ✓ Table exists');
    }

    console.log('\nTable: all_offpremises_checkins');
    if (allError) {
      console.log(`  Error: ${allError.message}`);
    } else {
      console.log('  ✓ Table exists');
    }

    // Now query pending_offpremises_checkins
    console.log('\n---\nQuerying pending_offpremises_checkins for today...\n');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('pending_offpremises_checkins')
      .select('*')
      .gte('created_at', today.toISOString())
      .lte('created_at', todayEnd.toISOString());

    if (error) {
      console.error('Error fetching data:', error);
      return;
    }

    console.log(`✅ YES - Staff CAN request for off-premises check-in`);
    console.log(`\n📊 Today's Off-Premises Check-In Requests: ${data?.length || 0}`);
    
    if (data && data.length > 0) {
      console.log('\nRequest Details:');
      data.forEach((req, index) => {
        console.log(`\n${index + 1}. Staff ID: ${req.staff_id || req.user_id}`);
        console.log(`   Status: ${req.status}`);
        console.log(`   Reason: ${req.reason || req.description || 'N/A'}`);
        console.log(`   Created: ${new Date(req.created_at).toLocaleString()}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

listTables();
