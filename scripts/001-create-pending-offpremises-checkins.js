import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createTable() {
  try {
    console.log('Creating pending_offpremises_checkins table...')

    // Create table
    const { error: tableError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.pending_offpremises_checkins (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
          current_location_name TEXT NOT NULL,
          latitude FLOAT8 NOT NULL,
          longitude FLOAT8 NOT NULL,
          accuracy FLOAT8,
          device_info TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          approved_by_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
          approved_at TIMESTAMP WITH TIME ZONE,
          rejection_reason TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_pending_offpremises_user_id ON public.pending_offpremises_checkins(user_id);
        CREATE INDEX IF NOT EXISTS idx_pending_offpremises_status ON public.pending_offpremises_checkins(status);
        CREATE INDEX IF NOT EXISTS idx_pending_offpremises_created_at ON public.pending_offpremises_checkins(created_at DESC);
      `
    })

    if (tableError) {
      console.error('Error creating table:', tableError)
      process.exit(1)
    }

    console.log('Table created successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

createTable()
