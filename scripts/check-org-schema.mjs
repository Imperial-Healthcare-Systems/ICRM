// Verify organisations table columns
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// 1. try inserting a test row with gstin to confirm column existence
const { data, error } = await supabase
  .from('organisations')
  .insert({
    name: '__schema_check__' + Date.now(),
    slug: '__schema_check_' + Date.now(),
    gstin: 'TEST',
    plan_tier: 'starter',
    subscription_status: 'trial',
    icrm_enabled: true,
  })
  .select('id, gstin, plan_tier, subscription_status')
  .single()

if (error) {
  console.error('INSERT FAILED:', error)
} else {
  console.log('INSERT OK:', data)
  // cleanup
  await supabase.from('organisations').delete().eq('id', data.id)
  console.log('cleaned up test row')
}
