import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const { data, error: dbError } = await supabaseAdmin
    .from('organisations')
    .select('id, name, billing_email, phone, website, gstin, pan, address, logo_url, plan_tier, subscription_status, trial_ends_at, created_at')
    .eq('id', orgId)
    .single()

  if (dbError || !data) return NextResponse.json({ error: 'Organisation not found.' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  const allowed = ['name', 'phone', 'website', 'gstin', 'pan', 'address', 'logo_url']
  const updates = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))

  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })

  const { data, error: dbError } = await supabaseAdmin
    .from('organisations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', orgId)
    .select('id, name')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAudit({ org_id: orgId, actor_id: actorId, action: 'org.updated', resource_type: 'organisation', resource_id: orgId, meta: updates })
  return NextResponse.json({ data })
}
