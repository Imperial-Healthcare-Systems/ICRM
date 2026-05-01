// Diagnose login failure: does this email exist as a CRM user?
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const email = (process.argv[2] ?? 'imperialhealthcaresystems@gmail.com').toLowerCase()
console.log(`Checking: ${email}\n`)

// Check crm_users
const { data: users } = await supa
  .from('crm_users')
  .select('id, email, full_name, role, is_active, crm_enabled, org_id')
  .eq('email', email)

console.log(`crm_users matches: ${users?.length ?? 0}`)
if (users?.length) {
  for (const u of users) {
    console.log(' ', u)
    const { data: org } = await supa.from('organisations').select('id, name, plan_tier, subscription_status, icrm_enabled, hrms_enabled').eq('id', u.org_id).single()
    console.log('  → org:', org)
  }
} else {
  console.log('  No CRM user with this email exists.')
}
