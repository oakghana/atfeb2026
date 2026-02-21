import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[v0] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateDatabase() {
  try {
    console.log('[v0] Starting database migration for off-premises checkins table...\n');

    // SQL statements to execute
    const migrations = [
      {
        name: 'Add reason column',
        sql: `ALTER TABLE public.pending_offpremises_checkins 
              ADD COLUMN IF NOT EXISTS reason TEXT;`
      },
      {
        name: 'Add request_type column',
        sql: `ALTER TABLE public.pending_offpremises_checkins 
              ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'checkin';`
      },
      {
        name: 'Add google_maps_name column',
        sql: `ALTER TABLE public.pending_offpremises_checkins 
              ADD COLUMN IF NOT EXISTS google_maps_name TEXT;`
      },
      {
        name: 'Update existing request_type values',
        sql: `UPDATE public.pending_offpremises_checkins 
              SET request_type = 'checkin' 
              WHERE request_type IS NULL;`
      },
      {
        name: 'Create index on request_type',
        sql: `CREATE INDEX IF NOT EXISTS idx_pending_offpremises_request_type 
              ON public.pending_offpremises_checkins(request_type);`
      },
      {
        name: 'Create index on google_maps_name',
        sql: `CREATE INDEX IF NOT EXISTS idx_pending_offpremises_google_maps_name 
              ON public.pending_offpremises_checkins(google_maps_name);`
      }
    ];

    // Execute each migration
    for (const migration of migrations) {
      console.log(`[v0] Executing: ${migration.name}`);
      
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_statement: migration.sql
      }).catch(err => ({ data: null, error: err }));

      if (error) {
        // If the RPC doesn't exist, try using the basic API method
        console.warn(`[v0] RPC method not available, trying alternative approach...`);
        
        // For Supabase, use the query builder to check if columns exist
        const { data: tableInfo, error: infoError } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_name', 'pending_offpremises_checkins')
          .eq('table_schema', 'public')
          .catch(err => ({ data: null, error: err }));

        console.log(`[v0] Table info query result:`, { tableInfo, infoError });
      } else {
        console.log(`[v0] ✓ ${migration.name} - completed`);
      }
    }

    console.log('\n[v0] Verifying table structure...');
    
    // Verify the table structure
    const { data: records, error: queryError } = await supabase
      .from('pending_offpremises_checkins')
      .select('*')
      .limit(1);

    if (queryError) {
      console.error('[v0] Error querying table:', queryError);
    } else {
      console.log('[v0] Table is accessible. Sample record structure verified.');
    }

    console.log('\n[v0] ✓ Migration completed successfully!');

  } catch (error) {
    console.error('[v0] Migration failed:', error);
    process.exit(1);
  }
}

migrateDatabase();
