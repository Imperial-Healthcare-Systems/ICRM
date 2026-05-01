import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

console.log('=== All CRM users ===')
const { data: users } = await supa.from('crm_users').select('email, full_name, role, is_active, crm_enabled, org_id').order('email')
for (const u of users ?? []) console.log(`  ${u.email} | ${u.full_name} | ${u.role} | active=${u.is_active} crm_enabled=${u.crm_enabled}`)

console.log(`\n=== All organisations ===`)
const { data: orgs } = await supa.from('organisations').select('id, name, plan_tier, subscription_status, icrm_enabled, hrms_enabled, billing_email').order('created_at')
for (const o of orgs ?? []) console.log(`  ${o.name} | plan=${o.plan_tier} status=${o.subscription_status} icrm=${o.icrm_enabled} hrms=${o.hrms_enabled} billing=${o.billing_email}`)
