// Diagnose + seed pipeline stages for the active user's org.
// Usage: node scripts/seed-stages-for-user.mjs <user_email>
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const email = (process.argv[2] ?? 'mehranischay9@gmail.com').toLowerCase()
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: user } = await supa.from('crm_users').select('id, org_id, full_name').eq('email', email).single()
if (!user) { console.error('User not found:', email); process.exit(1) }
console.log(`User: ${user.full_name} | Org: ${user.org_id}`)

const { count: existing } = await supa.from('crm_pipeline_stages').select('*', { count: 'exact', head: true }).eq('org_id', user.org_id)
console.log(`Existing stages: ${existing}`)

if (existing && existing > 0) { console.log('Org already has stages — nothing to do.'); process.exit(0) }

const STAGES = [
  { name: 'Qualification', position: 0, probability: 10,  color: '#6B7280', is_won: false, is_lost: false },
  { name: 'Proposal Sent', position: 1, probability: 30,  color: '#3B82F6', is_won: false, is_lost: false },
  { name: 'Demo Done',     position: 2, probability: 50,  color: '#8B5CF6', is_won: false, is_lost: false },
  { name: 'Negotiation',   position: 3, probability: 70,  color: '#F59E0B', is_won: false, is_lost: false },
  { name: 'Won',           position: 4, probability: 100, color: '#10B981', is_won: true,  is_lost: false },
  { name: 'Lost',          position: 5, probability: 0,   color: '#EF4444', is_won: false, is_lost: true  },
]

const { data, error } = await supa.from('crm_pipeline_stages').insert(STAGES.map(s => ({ ...s, org_id: user.org_id }))).select('id, name')
if (error) { console.error('FAIL:', error); process.exit(1) }
console.log(`Seeded ${data.length} stages:`, data.map(d => d.name).join(', '))
