import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkData() {
  try {
    console.log('Checking pending_offpremises_checkins table...')

    // Check if table has any data
    const { data, error, count } = await supabase
      .from('pending_offpremises_checkins')
      .select('*', { count: 'exact' })

    if (error) {
      console.error('Error querying table:', error)
      process.exit(1)
    }

    console.log(`Total records in table: ${count}`)
    console.log('Records:', JSON.stringify(data, null, 2))

    if (count === 0) {
      console.log('\n⚠️  No pending off-premises check-in requests in the database')
      console.log('This is expected if no staff members have submitted requests yet.')
      console.log('Have a staff member click "Check In Outside Premises" and try again.')
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

checkData()
