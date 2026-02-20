const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

// Load .env.local (simple parser)
const envPath = path.resolve(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8')
  raw.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([^#][^=\s]*)=(.*)$/)
    if (m) {
      const key = m[1]
      let val = m[2] || ''
      val = val.replace(/^\"|\"$/g, '').replace(/^\'|\'$/g, '')
      process.env[key] = val
    }
  })
}

const sql = `
CREATE TABLE IF NOT EXISTS public.pending_offpremises_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  current_location_name TEXT NOT NULL,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  accuracy FLOAT8,
  device_info TEXT,
  request_type TEXT NOT NULL DEFAULT 'checkin',
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

async function run() {
  const pgUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_DATABASE
  if (!pgUrl || pgUrl === 'postgres') {
    console.error('No valid Postgres connection string found in .env.local (check POSTGRES_URL_NON_POOLING / POSTGRES_PRISMA_URL / POSTGRES_URL).')
    process.exit(1)
  }

  const client = new Client({ connectionString: pgUrl })
  try {
    await client.connect()
    console.log('Connected to Postgres — executing CREATE TABLE...')
    await client.query(sql)
    console.log('\n✅ Table "pending_offpremises_checkins" created or already exists.')
  } catch (err) {
    console.error('Failed to run SQL:', err.message || err)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

run()
