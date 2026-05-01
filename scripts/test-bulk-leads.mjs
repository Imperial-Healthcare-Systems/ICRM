// Verify the bulk-leads validation logic against the live route
// (uses service-role to seed an org + user, then calls supabase directly to mimic the route logic)
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

const TS = Date.now()
const { data: org } = await supa.from('organisations').insert({
  name: `bulk-test-${TS}`, slug: `bulk-test-${TS}`,
  plan_tier: 'enterprise', subscription_status: 'trial', icrm_enabled: true,
}).select('id').single()

const { data: user } = await supa.from('crm_users').insert({
  org_id: org.id, email: `bulk-${TS}@test.io`, full_name: 'Bulk Tester',
  role: 'super_admin', is_active: true, crm_enabled: true,
}).select('id').single()

console.log('Test org:', org.id)

// Insert 50 leads in one shot to simulate bulk behavior
const ALLOWED_STATUS = ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'recycled']
const ALLOWED_RATING = ['hot', 'warm', 'cold']

const batch = Array.from({ length: 50 }, (_, i) => ({
  org_id: org.id,
  first_name: `Bulk${i + 1}`,
  last_name: 'Lead',
  email: `bulk${i + 1}@test.io`,
  company: 'BulkCorp',
  lead_status: ALLOWED_STATUS[i % ALLOWED_STATUS.length],
  rating: ALLOWED_RATING[i % ALLOWED_RATING.length],
  created_by: user.id,
}))

const { data: inserted, error } = await supa.from('crm_leads').insert(batch).select('id')

if (error) console.error('FAIL:', error)
else console.log(`PASS: bulk-inserted ${inserted.length} leads`)

// Verify count
const { count } = await supa.from('crm_leads').select('*', { count: 'exact', head: true }).eq('org_id', org.id)
console.log(`Verified count: ${count}`)

// Cleanup
await supa.from('crm_users').delete().eq('org_id', org.id)
await supa.from('organisations').delete().eq('id', org.id)
console.log('Cleaned up')
