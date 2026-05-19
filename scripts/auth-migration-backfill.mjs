// Phase B bulk backfill: for every `identities` row that doesn't yet have a
// matching `auth.users` row, create one sharing the same UUID. Idempotent —
// re-runs are safe; rows that already exist are skipped with a status note.
//
// Usage:
//   node scripts/auth-migration-backfill.mjs           # dry-run (default)
//   node scripts/auth-migration-backfill.mjs --apply   # actually create rows
//
// Pre-requisites:
//   - scripts/auth-migration-preflight.mjs PASSED (createUser accepts `id`)
//   - identities.email is non-null for every row you want migrated
//
// What this script DOES NOT do:
//   - It does NOT modify identities rows.
//   - It does NOT delete or update existing auth.users rows.
//   - It does NOT send any emails. email_confirm:true marks the email
//     verified silently so users don't get a confirmation prompt.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const APPLY = process.argv.includes('--apply')

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

console.log(`─── Phase B bulk backfill (${APPLY ? 'APPLY' : 'DRY RUN'}) ─────────────`)
console.log('')

// ── 1. Fetch all identities ──────────────────────────────────────────
const { data: identities, error: idErr } = await supa
  .from('identities')
  .select('id, email, full_name, is_platform_admin')
  .order('created_at', { ascending: true })

if (idErr) {
  console.error('FAIL: could not fetch identities:', idErr.message)
  process.exit(1)
}

console.log(`Identities total: ${identities.length}`)

// ── 2. Fetch all auth.users (paginated; with 14 identities we won't need >1 page) ──
const authUsers = []
let page = 1
while (true) {
  const { data, error } = await supa.auth.admin.listUsers({ page, perPage: 200 })
  if (error) {
    console.error('FAIL: listUsers errored:', error.message)
    process.exit(1)
  }
  authUsers.push(...data.users)
  if (data.users.length < 200) break
  page++
}
console.log(`auth.users total:  ${authUsers.length}`)
console.log('')

const authById    = new Map(authUsers.map(u => [u.id, u]))
const authByEmail = new Map(
  authUsers
    .filter(u => u.email)
    .map(u => [u.email.toLowerCase(), u]),
)

// ── 3. Categorise every identity ────────────────────────────────────
const buckets = {
  alreadyOk:     [], // identity.id === auth.users.id (no work)
  needsInsert:   [], // no auth.users row exists for this id or email
  emailCollide:  [], // email used by a DIFFERENT auth.users id — needs human decision
  noEmail:       [], // identity.email is null/empty — can't migrate
}

for (const ident of identities) {
  const email = ident.email?.toLowerCase().trim() ?? ''
  if (!email) {
    buckets.noEmail.push(ident)
    continue
  }
  const matchById    = authById.get(ident.id)
  const matchByEmail = authByEmail.get(email)

  if (matchById && matchById.email?.toLowerCase() === email) {
    buckets.alreadyOk.push(ident)
  } else if (!matchById && !matchByEmail) {
    buckets.needsInsert.push(ident)
  } else if (matchByEmail && matchByEmail.id !== ident.id) {
    buckets.emailCollide.push({ ident, conflicting: matchByEmail })
  } else if (matchById && matchById.email?.toLowerCase() !== email) {
    // Same id, different email — unusual but possible if someone changed it
    buckets.emailCollide.push({ ident, conflicting: matchById })
  } else {
    buckets.needsInsert.push(ident)
  }
}

console.log('─── Categorisation ──────────────────────────────────────')
console.log(`  Already OK (UUID + email match):    ${buckets.alreadyOk.length}`)
console.log(`  Needs insert:                       ${buckets.needsInsert.length}`)
console.log(`  Email collision (manual review):    ${buckets.emailCollide.length}`)
console.log(`  No email (skipped):                 ${buckets.noEmail.length}`)
console.log('')

if (buckets.emailCollide.length > 0) {
  console.log('⚠  EMAIL COLLISIONS — these need human resolution before the bulk backfill can proceed:')
  for (const { ident, conflicting } of buckets.emailCollide) {
    console.log(`   identity ${ident.id} (${ident.email}) ↔ auth.users ${conflicting.id}`)
  }
  console.log('')
}

if (buckets.noEmail.length > 0) {
  console.log('⚠  NO-EMAIL identities — these will remain unmigrated until their email is set:')
  for (const ident of buckets.noEmail) {
    console.log(`   ${ident.id} (full_name=${ident.full_name ?? '∅'})`)
  }
  console.log('')
}

// ── 4. Apply (or report what would happen) ──────────────────────────
if (buckets.needsInsert.length === 0) {
  console.log('Nothing to insert. Bulk backfill is a no-op.')
  process.exit(0)
}

if (!APPLY) {
  console.log('─── DRY RUN — would insert these auth.users rows ─────────')
  for (const ident of buckets.needsInsert) {
    console.log(`   ${ident.id}  ${ident.email}${ident.is_platform_admin ? '  [platform admin]' : ''}`)
  }
  console.log('')
  console.log('Re-run with --apply to perform the inserts.')
  process.exit(0)
}

console.log('─── APPLYING inserts ────────────────────────────────────')
let inserted = 0
let failed = 0
for (const ident of buckets.needsInsert) {
  const { data, error } = await supa.auth.admin.createUser({
    id: ident.id,
    email: ident.email,
    email_confirm: true,
  })
  if (error) {
    console.log(`   ✗ ${ident.id} ${ident.email} — ${error.message}`)
    failed++
    continue
  }
  if (data.user.id !== ident.id) {
    console.log(`   ✗ ${ident.id} ${ident.email} — UUID mismatch (got ${data.user.id})`)
    failed++
    continue
  }
  console.log(`   ✓ ${ident.id} ${ident.email}`)
  inserted++
}

console.log('')
console.log('─── Done ────────────────────────────────────────────────')
console.log(`  Inserted: ${inserted}`)
console.log(`  Failed:   ${failed}`)
console.log(`  Total auth.users now: ${authUsers.length + inserted}`)
console.log('')
console.log('Re-run without --apply to verify everything settled correctly.')
