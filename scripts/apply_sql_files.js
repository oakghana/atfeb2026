const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

// Load .env.local
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

const sqlFiles = [
  path.join(__dirname, '039_add_reason_to_offpremises.sql'),
  path.join(__dirname, '042_add_request_type_to_pending_offpremises.sql'),
]

async function run() {
  const pgUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_DATABASE
  if (!pgUrl || pgUrl === 'postgres') {
    console.error('No valid Postgres connection string found in .env.local (check POSTGRES_URL_NON_POOLING / POSTGRES_PRISMA_URL / POSTGRES_URL).')
    process.exit(1)
  }

  // Accept self-signed certs for local/dev Postgres (safe for local development only)
  const client = new Client({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    console.log('Connected to Postgres — applying SQL files...')

    for (const file of sqlFiles) {
      if (!fs.existsSync(file)) {
        console.warn('SQL file not found, skipping:', file)
        continue
      }
      const sql = fs.readFileSync(file, 'utf8')
      console.log('\n---- Running:', path.basename(file), '----\n')
      try {
        await client.query(sql)
        console.log(`✓ ${path.basename(file)} applied successfully`)
      } catch (err) {
        console.error(`✗ Error applying ${path.basename(file)}:`, err.message || err)
      }
    }

    console.log('\nAll SQL files processed.')
  } catch (err) {
    console.error('Failed to run SQL files:', err.message || err)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

run().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
