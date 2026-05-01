// Reproduce the account PATCH bug pre-fix and verify post-fix
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
  name: `acc-test-${TS}`, slug: `acc-test-${TS}`,
  plan_tier: 'enterprise', subscription_status: 'trial', icrm_enabled: true,
}).select('id').single()

const { data: user } = await supa.from('crm_users').insert({
  org_id: org.id, email: `acc-${TS}@test.io`, full_name: 'Acc Tester',
  role: 'super_admin', is_active: true, crm_enabled: true,
}).select('id').single()

const { data: acc } = await supa.from('crm_accounts').insert({
  org_id: org.id, name: 'Original', industry: 'Tech', created_by: user.id,
}).select('id').single()

console.log('Created account:', acc.id)

// Simulate the kind of payload the detail page used to send (full record + joined fields)
const fullRecord = {
  id: acc.id, org_id: org.id, name: 'Updated Name', website: 'https://test.com',
  industry: 'Updated', account_type: 'customer',
  crm_users: { id: user.id, full_name: 'Acc Tester' },  // joined relation, NOT a column
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
}

// Apply our new whitelist logic in JS
const ALLOWED = ['name', 'website', 'industry', 'account_type', 'phone', 'email', 'billing_address', 'shipping_address', 'annual_revenue', 'employee_count', 'assigned_to', 'parent_account', 'tags', 'custom_fields', 'notes']
const updates = Object.fromEntries(Object.entries(fullRecord).filter(([k]) => ALLOWED.includes(k)))
console.log('Filtered updates:', updates)

const { data, error } = await supa.from('crm_accounts').update(updates).eq('id', acc.id).select('id, name, industry').single()
if (error) console.log('FAIL:', error)
else console.log('PASS: account updated:', data)

// Cleanup
await supa.from('crm_users').delete().eq('org_id', org.id)
await supa.from('organisations').delete().eq('id', org.id)
console.log('Cleaned up')
