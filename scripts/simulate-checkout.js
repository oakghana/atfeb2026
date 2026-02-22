#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadDotEnv(envPath) {
  try {
    const raw = fs.readFileSync(envPath, 'utf8')
    const lines = raw.split(/\r?\n/)
    for (const line of lines) {
      const m = line.match(/^(\w+)=(.*)$/)
      if (m) {
        const key = m[1]
        let val = m[2]
        // strip optional surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        if (!process.env[key]) process.env[key] = val
      }
    }
  } catch (err) {
    // ignore
  }
}

async function main() {
  // attempt to load .env.local in repo root
  const envPath = path.resolve(process.cwd(), '.env.local')
  loadDotEnv(envPath)

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment or .env.local')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const today = new Date().toISOString().split('T')[0]

  console.log('[simulate-checkout] Looking for an active check-in for today')

  const { data: attendance, error: findError } = await supabase
    .from('attendance_records')
    .select('*')
    .gte('check_in_time', `${today}T00:00:00Z`)
    .lt('check_in_time', `${today}T23:59:59Z`)
    .is('check_out_time', null)
    .limit(1)

  if (findError) {
    console.error('[simulate-checkout] Error querying attendance:', findError)
    process.exit(1)
  }

  const record = Array.isArray(attendance) ? attendance[0] : attendance

  if (!record) {
    console.log('[simulate-checkout] No open attendance record found for today.')
    process.exit(0)
  }

  console.log('[simulate-checkout] Found attendance id=', record.id, 'user_id=', record.user_id)

  const now = new Date()
  const checkInTime = new Date(record.check_in_time)
  const workHours = Math.round(((now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)) * 100) / 100

  const update = {
    check_out_time: now.toISOString(),
    check_out_method: 'simulated_admin',
    work_hours: workHours,
    updated_at: new Date().toISOString(),
  }

  const { data: updated, error: updateError } = await supabase
    .from('attendance_records')
    .update(update)
    .eq('id', record.id)
    .select()
    .single()

  if (updateError) {
    console.error('[simulate-checkout] Failed to update attendance:', updateError)
    process.exit(1)
  }

  console.log('[simulate-checkout] Checkout simulated successfully for record id=', updated.id)
  console.log(JSON.stringify(updated, null, 2))

  // insert audit log
  await supabase.from('audit_logs').insert({
    user_id: updated.user_id,
    action: 'simulated_admin_checkout',
    table_name: 'attendance_records',
    record_id: updated.id,
    new_values: updated,
    details: { note: 'Simulated checkout performed by local script' },
  })

  process.exit(0)
}

main().catch((err) => {
  console.error('[simulate-checkout] Unexpected error:', err)
  process.exit(1)
})
