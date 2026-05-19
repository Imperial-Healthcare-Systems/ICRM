// Phase B pre-flight: verify that supabase.auth.admin.createUser accepts an
// explicit `id` parameter, so the bulk backfill can create auth.users rows
// that share UUIDs with their identities row (auth.uid() = identities.id).
//
// Usage:
//   node scripts/auth-migration-preflight.mjs
//
// Safe to re-run. If the test row already exists in auth.users, the script
// reports it and exits without trying to recreate. No data is deleted.
//
// What this script does NOT do:
//   - It does NOT bulk-backfill. Run scripts/auth-migration-backfill.mjs
//     after the pre-flight passes and you've reviewed the summary.
//   - It does NOT touch identities rows.
//   - It does NOT remove or alter auth.users rows that already exist.

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
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// Pick the platform admin identity as the test subject. Per project memory
// this is imperialhealthcaresystems@gmail.com.
const TEST_EMAIL = process.argv[2]?.toLowerCase().trim() ?? 'imperialhealthcaresystems@gmail.com'

console.log('─── Phase B pre-flight ──────────────────────────────────')
console.log(`Test subject email: ${TEST_EMAIL}`)
console.log('')

// ── 1. Count the backfill scope ──────────────────────────────────────
const { count: identityCount, error: countErr } = await supa
  .from('identities')
  .select('id', { count: 'exact', head: true })

if (countErr) {
  console.error('FAIL: could not count identities:', countErr.message)
  process.exit(1)
}
console.log(`Total identities rows in DB: ${identityCount}`)

const { data: missingEmail, error: missingErr } = await supa
  .from('identities')
  .select('id')
  .or('email.is.null,email.eq.')
  .limit(5)
if (missingErr) {
  console.error('FAIL: could not scan identities for null email:', missingErr.message)
  process.exit(1)
}
if (missingEmail && missingEmail.length > 0) {
  console.log(`⚠  ${missingEmail.length}+ identities row(s) have NULL or empty email — these CANNOT be backfilled to auth.users until their email is fixed.`)
  console.log(`   Sample IDs: ${missingEmail.map(r => r.id).join(', ')}`)
}

// ── 2. Find the test identity ────────────────────────────────────────
const { data: testIdentity, error: idErr } = await supa
  .from('identities')
  .select('id, email')
  .eq('email', TEST_EMAIL)
  .maybeSingle()

if (idErr) {
  console.error('FAIL: could not query identities:', idErr.message)
  process.exit(1)
}
if (!testIdentity) {
  console.error(`FAIL: no identities row for ${TEST_EMAIL}.`)
  console.error('Pass a different email as argv[2] to retry with another identity.')
  process.exit(1)
}
console.log(`Test identity: ${testIdentity.id} (${testIdentity.email})`)
console.log('')

// ── 3. Check whether auth.users already has a row for this email ────
//     We can't query auth.users directly without service-role-scoped helpers,
//     but admin.listUsers() lets us scan by email.
const { data: listed, error: listErr } = await supa.auth.admin.listUsers({ page: 1, perPage: 200 })
if (listErr) {
  console.error('FAIL: auth.admin.listUsers errored:', listErr.message)
  console.error('This usually means the service-role key is wrong or the Email auth provider is disabled.')
  process.exit(1)
}
const existing = listed.users.find(u => u.email?.toLowerCase() === TEST_EMAIL)
if (existing) {
  console.log(`auth.users row ALREADY EXISTS for ${TEST_EMAIL}: ${existing.id}`)
  if (existing.id === testIdentity.id) {
    console.log('  ✓ UUIDs already match — this identity is good to go.')
  } else {
    console.log(`  ⚠  UUID MISMATCH — identity ${testIdentity.id} vs auth.users ${existing.id}`)
    console.log('     Bulk backfill will need a strategy for the mismatched subset.')
  }
  console.log('')
  console.log('Skipping createUser test (would conflict). Phase B can still proceed —')
  console.log('the bulk script will check existence first and only insert missing rows.')
  process.exit(0)
}

// ── 4. The actual test: createUser with explicit id ─────────────────
console.log('Calling supabase.auth.admin.createUser({ id, email, email_confirm: true })…')
const { data: created, error: createErr } = await supa.auth.admin.createUser({
  id: testIdentity.id,
  email: testIdentity.email,
  email_confirm: true,
})

if (createErr) {
  console.error('FAIL: createUser errored:', createErr.message)
  console.error(JSON.stringify(createErr, null, 2))
  console.error('')
  console.error('If the error says "id" is not accepted, we fall back to plan B:')
  console.error('  - Let Supabase generate auth.users.id, then add identities.auth_user_id')
  console.error('    as an FK column and update RLS policies to join through it.')
  process.exit(1)
}

if (!created?.user) {
  console.error('FAIL: createUser returned no user payload')
  process.exit(1)
}

if (created.user.id !== testIdentity.id) {
  console.error(`FAIL: UUID mismatch — passed ${testIdentity.id}, got back ${created.user.id}`)
  console.error('Supabase silently overrode the id parameter. Need to use plan B.')
  process.exit(1)
}

console.log('')
console.log('✓ SUCCESS')
console.log(`  auth.users.id        = ${created.user.id}`)
console.log(`  identities.id        = ${testIdentity.id}`)
console.log(`  email_confirmed_at   = ${created.user.email_confirmed_at}`)
console.log(`  created_at           = ${created.user.created_at}`)
console.log('')
console.log('Phase B pre-flight passed. Ready to run the bulk backfill next.')
console.log('Re-run this script and you should now see "auth.users row ALREADY EXISTS".')
