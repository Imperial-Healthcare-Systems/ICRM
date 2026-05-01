// Create a CRM super_admin user linked to an existing organisation.
// Usage: node scripts/link-crm-user.mjs <email> <full_name>
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const email = (process.argv[2] ?? '').toLowerCase().trim()
const fullName = process.argv[3] ?? 'Admin User'
if (!email) { console.error('Usage: node scripts/link-crm-user.mjs <email> "<Full Name>"'); process.exit(1) }

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Find the org via billing_email
const { data: org } = await supa.from('organisations').select('id, name, icrm_enabled').eq('billing_email', email).single()
if (!org) { console.error(`No org with billing_email=${email}`); process.exit(1) }
console.log(`Org: ${org.name} (${org.id})`)

if (!org.icrm_enabled) {
  await supa.from('organisations').update({ icrm_enabled: true }).eq('id', org.id)
  console.log('  → enabled icrm_enabled=true on the org')
}

// Check if user already exists in this org
const { data: existing } = await supa.from('crm_users').select('id').eq('email', email).eq('org_id', org.id).maybeSingle()
if (existing) { console.log(`CRM user already exists: ${existing.id}`); process.exit(0) }

const { data: user, error } = await supa.from('crm_users').insert({
  org_id: org.id,
  email,
  full_name: fullName,
  role: 'super_admin',
  is_active: true,
  crm_enabled: true,
}).select('id').single()

if (error) { console.error('Insert failed:', error); process.exit(1) }
console.log(`CRM user created: ${user.id}`)

// Seed pipeline stages if missing
const { count: stageCount } = await supa.from('crm_pipeline_stages').select('*', { count: 'exact', head: true }).eq('org_id', org.id)
if ((stageCount ?? 0) === 0) {
  const STAGES = [
    { name: 'Qualification', position: 0, probability: 10,  color: '#6B7280', is_won: false, is_lost: false },
    { name: 'Proposal Sent', position: 1, probability: 30,  color: '#3B82F6', is_won: false, is_lost: false },
    { name: 'Demo Done',     position: 2, probability: 50,  color: '#8B5CF6', is_won: false, is_lost: false },
    { name: 'Negotiation',   position: 3, probability: 70,  color: '#F59E0B', is_won: false, is_lost: false },
    { name: 'Won',           position: 4, probability: 100, color: '#10B981', is_won: true,  is_lost: false },
    { name: 'Lost',          position: 5, probability: 0,   color: '#EF4444', is_won: false, is_lost: true  },
  ]
  await supa.from('crm_pipeline_stages').insert(STAGES.map(s => ({ ...s, org_id: org.id })))
  console.log('  → seeded 6 default pipeline stages')
}

// Seed credits if missing
const { data: credits } = await supa.from('org_credits').select('balance').eq('org_id', org.id).maybeSingle()
if (!credits) {
  await supa.from('org_credits').insert({ org_id: org.id, balance: 100, total_purchased: 100 })
  console.log('  → seeded 100 starter credits')
}

console.log(`\nDone. ${email} can now log in to ICRM.`)
