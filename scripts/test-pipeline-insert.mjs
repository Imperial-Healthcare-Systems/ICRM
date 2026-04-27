// Reproduce the pipeline stages insert directly and capture the error
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

// Create test org
const { data: org } = await supa.from('organisations').insert({
  name: 'pipe-test-' + Date.now(),
  slug: 'pipe-test-' + Date.now(),
  plan_tier: 'starter',
  subscription_status: 'trial',
  icrm_enabled: true,
}).select('id').single()

console.log('test org id:', org.id)

const stages = [
  { name: 'Qualification', position: 0, probability: 10, color: '#6B7280' },
  { name: 'Proposal Sent', position: 1, probability: 30, color: '#3B82F6' },
  { name: 'Demo Done',     position: 2, probability: 50, color: '#8B5CF6' },
  { name: 'Negotiation',   position: 3, probability: 70, color: '#F59E0B' },
  { name: 'Won',           position: 4, probability: 100, color: '#10B981', is_won: true },
  { name: 'Lost',          position: 5, probability: 0,  color: '#EF4444', is_lost: true },
]

const { data, error } = await supa.from('crm_pipeline_stages').insert(
  stages.map(s => ({ ...s, org_id: org.id }))
).select('id, name')

if (error) console.error('INSERT FAILED:', error)
else console.log('INSERT OK, got', data.length, 'stages:', data.map(d => d.name).join(', '))

// cleanup
await supa.from('organisations').delete().eq('id', org.id)
console.log('cleaned up')
