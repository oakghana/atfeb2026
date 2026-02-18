import { createClient } from '@/lib/supabase/client'

async function diagnosticCheck() {
  console.log('[v0 Diagnostic] Starting off-premises database check...')
  
  try {
    const supabase = createClient()

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    console.log('[v0 Diagnostic] Authenticated user:', user?.id)

    // Check pending_offpremises_checkins table
    const { data: pending, error: pendingError, count: pendingCount } = await supabase
      .from('pending_offpremises_checkins')
      .select('*', { count: 'exact' })
    
    console.log('[v0 Diagnostic] Pending requests:', {
      count: pendingCount,
      records: pending?.length,
      error: pendingError?.message,
      samples: pending?.slice(0, 3)
    })

    // Check approved_offpremises_checkins table
    const { data: approved, error: approvedError, count: approvedCount } = await supabase
      .from('approved_offpremises_checkins')
      .select('*', { count: 'exact' })
    
    console.log('[v0 Diagnostic] Approved records:', {
      count: approvedCount,
      records: approved?.length,
      error: approvedError?.message,
      samples: approved?.slice(0, 3)
    })

    // Check pending with status='approved'
    const { data: statusApproved, error: statusError, count: statusCount } = await supabase
      .from('pending_offpremises_checkins')
      .select('*', { count: 'exact' })
      .eq('status', 'approved')
    
    console.log('[v0 Diagnostic] Pending table with status=approved:', {
      count: statusCount,
      records: statusApproved?.length,
      error: statusError?.message
    })

    // Check all tables available
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
    
    console.log('[v0 Diagnostic] Available tables:', {
      error: tablesError?.message,
      tables: tables?.map(t => t.table_name).filter(t => t.includes('offpremises') || t.includes('attendance'))
    })

  } catch (error: any) {
    console.error('[v0 Diagnostic] Error:', error.message)
  }
}

// Run diagnostic when this file is imported
diagnosticCheck()
