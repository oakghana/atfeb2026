const fs = require('fs')
const path = require('path')

// Load .env.local if present (simple parser)
const envPath = path.resolve(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8')
  raw.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([^#][^=\s]*)=(.*)$/)
    if (m) {
      const key = m[1]
      let val = m[2] || ''
      // remove surrounding quotes
      val = val.replace(/^\"|\"$/g, '').replace(/^\'|\'$/g, '')
      process.env[key] = val
    }
  })
}

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase env vars. Ensure .env.local is loaded or env vars are set.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function run() {
  const testUserId = '8f23ae6a-8933-4594-ae41-f19a5c683284'
  console.log('Querying user_profiles for id=', testUserId)
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, first_name, last_name, role')
    .eq('id', testUserId)
    .maybeSingle()

  if (error) {
    console.error('Supabase error:', error.message)
    process.exit(1)
  }

  console.log('Result:', data)
}

run().catch(err => { console.error(err); process.exit(1) })