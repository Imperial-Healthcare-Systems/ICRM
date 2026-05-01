// Diagnose the 404 from /api/invoices/[id]/share
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const invoiceId = process.argv[2] ?? '63e2f46c-47ba-49b9-b4e7-8b4ccb9125e1'
console.log(`Checking invoice: ${invoiceId}\n`)

// 1) Does the invoice exist at all? (no org filter)
const { data: anyInv, error: e1 } = await supa
  .from('crm_invoices')
  .select('id, invoice_number, org_id, public_token')
  .eq('id', invoiceId)
  .maybeSingle()
console.log('1) Direct lookup:', { found: !!anyInv, error: e1?.message })
if (anyInv) console.log('   ', anyInv)

// 2) Can PostgREST see the new column? Try selecting just public_token
const { data: tokTest, error: e2 } = await supa
  .from('crm_invoices')
  .select('public_token, public_token_created_at')
  .eq('id', invoiceId)
  .maybeSingle()
console.log('\n2) Public_token column visibility:', { error: e2?.message ?? 'OK', data: tokTest })

// 3) Which org owns this invoice
if (anyInv?.org_id) {
  const { data: org } = await supa.from('organisations').select('name').eq('id', anyInv.org_id).single()
  console.log(`\n3) Owning org: ${org?.name} (${anyInv.org_id})`)

  const { data: users } = await supa.from('crm_users').select('email, role').eq('org_id', anyInv.org_id)
  console.log('   Users in this org:')
  for (const u of users ?? []) console.log(`     - ${u.email} (${u.role})`)
}
