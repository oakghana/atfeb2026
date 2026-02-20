import { Pool } from 'pg'

const connectionString = process.env.POSTGRES_URL_NON_POOLING || 'postgres://postgres.vgtajtqxgczhjboatvol:101SLRtsiEzLs1Sy@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require'

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
})

async function checkDatabase() {
  try {
    console.log('[v0] Connecting to database...')
    console.log('[v0] Connection string:', connectionString.split('@')[1])
    
    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)
    
    console.log('\n[v0] Tables found:')
    for (const row of tablesResult.rows) {
      console.log(`  - ${row.table_name}`)
    }
    
    // Check user_profiles table
    console.log('\n[v0] Checking user_profiles table...')
    try {
      const columnsResult = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_profiles'
        ORDER BY ordinal_position
      `)
      
      console.log('[v0] user_profiles columns:')
      for (const row of columnsResult.rows) {
        console.log(`  - ${row.column_name}: ${row.data_type}`)
      }
      
      // Count records
      const countResult = await pool.query('SELECT COUNT(*) as count FROM user_profiles')
      console.log(`[v0] user_profiles record count: ${countResult.rows[0].count}`)
      
      // Try to find the test user
      const testUserResult = await pool.query(
        "SELECT id, email FROM user_profiles WHERE email = $1 LIMIT 1",
        ['test@qccgh.com']
      )
      if (testUserResult.rows.length > 0) {
        console.log('[v0] Found test user:', testUserResult.rows[0])
      } else {
        console.log('[v0] Test user not found. Checking for similar emails...')
        const similarResult = await pool.query(
          "SELECT id, email FROM user_profiles WHERE email ILIKE '%qccgh%' LIMIT 5"
        )
        console.log('[v0] Similar emails:', similarResult.rows)
      }
    } catch (err) {
      console.log('[v0] user_profiles table error:', err.message)
    }
    
    await pool.end()
    console.log('\n[v0] Database check complete')
  } catch (error) {
    console.error('[v0] Database check failed:', error.message)
    process.exit(1)
  }
}

checkDatabase()
