const { createClient } = require('@supabase/supabase-js')

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in env')
    process.exit(1)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
  const { data, error } = await supabase.from('system_backups').select('id, created_at, metadata').order('created_at', { ascending: false }).limit(1)
  if (error) {
    console.error('Failed to fetch backups:', error)
    process.exit(1)
  }
  if (!data || data.length === 0) {
    console.log('No backups found')
    return
  }
  const b = data[0]
  console.log('Latest backup:', b.id, b.created_at)
  const meta = b.metadata || {}
  console.log('Tables:', (meta.metadata && meta.metadata.tables) || (meta.tables) || [])
  console.log('Record counts:', (meta.metadata && meta.metadata.metadata && meta.metadata.metadata.record_counts) || meta.record_counts || (meta.metadata && meta.metadata.record_counts) )
}

main().catch(e => { console.error(e); process.exit(1) })
