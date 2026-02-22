const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in env')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  const tables = [
    'user_profiles',
    'departments',
    'geofence_locations',
    'districts',
    'attendance_records',
    'schedules',
    'settings',
  ]

  const includeAuditLogs = !!process.env.INCLUDE_AUDIT_LOGS
  if (includeAuditLogs) tables.push('audit_logs')

  // verify existence
  const verified = []
  for (const t of tables) {
    try {
      const { data, error } = await supabase.from(t).select('*').limit(1)
      if (error) {
        console.warn(`Table ${t} probe error:`, error.message || error)
        continue
      }
      // If query succeeded (even with zero rows) the table exists
      verified.push(t)
    } catch (e) {
      console.warn(`Table ${t} probe exception:`, e.message || e)
    }
  }

  const PAGE_SIZE = 1000
  const backupData = {}
  let totalSize = 0

  for (const table of verified) {
    console.log(`Backing up table: ${table}`)
    const rows = []
    let from = 0
    while (true) {
      const to = from + PAGE_SIZE - 1
      const { data, error } = await supabase.from(table).select('*').range(from, to)
      if (error) {
        console.error(`Error reading ${table} range ${from}-${to}:`, error)
        break
      }
      if (data && data.length) {
        rows.push(...data)
      }
      if (!data || data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
    backupData[table] = rows
    const size = JSON.stringify(rows).length
    totalSize += size
    console.log(`Fetched ${rows.length} rows (${size} bytes) from ${table}`)
  }

  const backupId = `backup_${Date.now()}`
  const metadata = {
    id: backupId,
    timestamp: new Date().toISOString(),
    tables: Object.keys(backupData),
    record_counts: Object.fromEntries(Object.entries(backupData).map(([t, r]) => [t, r.length])),
    size_bytes: totalSize,
    config: { includeAuditLogs: includeAuditLogs }
  }

  const payload = { metadata, data: backupData }

  const { error: upsertErr } = await supabase.from('system_backups').upsert({
    id: backupId,
    created_at: new Date().toISOString(),
    size_bytes: JSON.stringify(payload).length,
    status: 'completed',
    metadata: payload,
  })

  if (upsertErr) {
    console.error('Failed to save backup record:', upsertErr)
    process.exit(1)
  }

  console.log(`Backup ${backupId} saved. Tables: ${metadata.tables.length}, total bytes: ${metadata.size_bytes}`)
}

main().catch(err => {
  console.error('Backup script failed:', err)
  process.exit(1)
})
