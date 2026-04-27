import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// Try inserting a row to see allowed columns
const { error } = await supa.from('ecosystem_events').insert({
  org_id: '00000000-0000-0000-0000-000000000000',
  event_type: 'test',
  source: 'icrm',
  payload: {},
  processed: false,
})
console.log('insert error:', error)

// Try with different column names
const { error: e2 } = await supa.from('ecosystem_events').insert({
  org_id: '00000000-0000-0000-0000-000000000000',
  event_type: 'test',
  payload: {},
  processed: false,
})
console.log('insert without source error:', e2)
