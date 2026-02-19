import { createClient } from '@supabase/supabase-js';

async function fixAutoRejection() {
  console.log("[v0] Fixing auto-rejected off-premises requests...");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get all rejected requests with rejection reason "Rejected" (the auto-reject marker)
    const { data: rejectedRequests } = await supabase
      .from('pending_offpremises_checkins')
      .select('id, user_id, status, rejection_reason, created_at, approved_at')
      .eq('status', 'rejected')
      .eq('rejection_reason', 'Rejected');

    console.log(`[v0] Found ${rejectedRequests?.length || 0} auto-rejected requests to fix`);

    if (rejectedRequests && rejectedRequests.length > 0) {
      // Reset these requests back to pending
      const requestIds = rejectedRequests.map(r => r.id);
      
      const { error: updateError } = await supabase
        .from('pending_offpremises_checkins')
        .update({
          status: 'pending',
          approved_by_id: null,
          approved_at: null,
          rejection_reason: null,
        })
        .in('id', requestIds);

      if (updateError) {
        console.error("[v0] Error updating requests:", updateError);
      } else {
        console.log(`[v0] Successfully reset ${requestIds.length} requests back to pending status`);
        rejectedRequests.forEach(req => {
          console.log(`[v0]   - Request ${req.id}: ${req.user_id} - Created at ${req.created_at}`);
        });
      }
    }

    // Verify the fix
    const { data: allRequests } = await supabase
      .from('pending_offpremises_checkins')
      .select('status');

    const breakdown = { pending: 0, approved: 0, rejected: 0 };
    allRequests?.forEach(r => {
      breakdown[r.status as keyof typeof breakdown]++;
    });

    console.log(`[v0] Status breakdown after fix:`, breakdown);

  } catch (error) {
    console.error("[v0] Exception:", error);
  }
}

fixAutoRejection();
