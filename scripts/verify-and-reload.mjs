// Verify gstin column exists at the SQL layer, then force schema reload
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Use pg-meta endpoint (Supabase exposes it for service-role keys)
async function pgQuery(sql) {
  const res = await fetch(`${supabaseUrl}/pg/query`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  return res.ok ? res.json() : { error: await res.text(), status: res.status }
}

const result = await pgQuery(`
  select column_name, data_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'organisations'
  order by ordinal_position
`)
console.log('Columns query:', JSON.stringify(result, null, 2))
