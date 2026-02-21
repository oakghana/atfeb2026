import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCheckoutFix() {
  console.log('\n=== CHECKOUT PERSISTENCE FIX VERIFICATION ===\n');

  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Query for the user's attendance record from today
    const { data: records, error } = await supabase
      .from('attendance_records')
      .select('id, user_id, check_in_time, check_out_time, work_hours, created_at')
      .gte('check_in_time', `${today}T00:00:00`)
      .lte('check_in_time', `${today}T23:59:59`)
      .order('check_in_time', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching records:', error);
      process.exit(1);
    }

    console.log(`\nFound ${records?.length || 0} attendance records from today:\n`);

    if (records && records.length > 0) {
      records.forEach((record, index) => {
        const hasCheckout = record.check_out_time !== null;
        const status = hasCheckout ? '✓ HAS CHECKOUT' : '✗ NO CHECKOUT';

        console.log(`${index + 1}. Record ID: ${record.id}`);
        console.log(`   User ID: ${record.user_id}`);
        console.log(`   Check-in: ${new Date(record.check_in_time).toLocaleTimeString()}`);
        console.log(`   Check-out: ${record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : 'NOT RECORDED'}`);
        console.log(`   Work Hours: ${record.work_hours ? record.work_hours.toFixed(2) : 'N/A'} hours`);
        console.log(`   Status: ${status}`);
        console.log('');
      });

      // Count records with checkout
      const recordsWithCheckout = records.filter(r => r.check_out_time !== null).length;
      const recordsWithoutCheckout = records.length - recordsWithCheckout;

      console.log(`\n--- SUMMARY ---`);
      console.log(`Records with checkout: ${recordsWithCheckout}/${records.length}`);
      console.log(`Records without checkout: ${recordsWithoutCheckout}/${records.length}`);

      if (recordsWithCheckout === 0 && recordsWithoutCheckout > 0) {
        console.log('\n⚠️  WARNING: NO CHECKOUT DATA FOUND');
        console.log('The API fix may not be taking effect yet. Try checking out again from the app.');
      } else if (recordsWithCheckout > 0) {
        console.log('\n✓ SUCCESS: Checkout data is being saved!');
      }
    } else {
      console.log('No attendance records found for today');
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

verifyCheckoutFix();
