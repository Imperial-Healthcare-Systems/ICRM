import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient, requireWriteAccess } from '@/lib/session'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const HEX = /^#[0-9a-fA-F]{6}$/

const ALLOWED_LEVELS = ['none', 'logo', 'full', 'custom_domain']

const ALLOWED_FIELDS = [
  'level',
  'logo_url', 'logo_dark_url', 'favicon_url',
  'primary_color', 'accent_color',
  'app_name_crm',
  'email_from_name', 'email_from_addr',
  'hide_powered_by',
  'invoice_logo_url', 'invoice_footer_text',
]

export async function GET() {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error
  const { orgId } = session.user

  const { data, error: dbError } = await supabase
    .from('org_branding')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ data: data ?? { org_id: orgId, level: 'none' } })
}

export async function PATCH(req: NextRequest) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: actorId, role } = session.user

  if (!['super_admin', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Only admins can update branding.' }, { status: 403 })
  }

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  for (const key of ALLOWED_FIELDS) {
    if (!(key in body)) continue
    const value = body[key]

    if (key === 'level') {
      if (typeof value !== 'string' || !ALLOWED_LEVELS.includes(value)) {
        return NextResponse.json({ error: `level must be one of: ${ALLOWED_LEVELS.join(', ')}` }, { status: 400 })
      }
      updates.level = value
      continue
    }

    if (key === 'primary_color' || key === 'accent_color') {
      if (value === null || value === '') { updates[key] = null; continue }
      if (typeof value !== 'string' || !HEX.test(value)) {
        return NextResponse.json({ error: `${key} must be a 6-digit hex like #F47920` }, { status: 400 })
      }
      updates[key] = value
      continue
    }

    if (key === 'hide_powered_by') {
      updates.hide_powered_by = Boolean(value)
      continue
    }

    if (typeof value === 'string') {
      const trimmed = value.trim()
      updates[key] = trimmed === '' ? null : trimmed
      continue
    }

    if (value === null) {
      updates[key] = null
      continue
    }
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
  }

  if ('email_from_addr' in updates && updates.email_from_addr !== null) {
    updates.email_dns_verified = false
  }

  const { data, error: dbError } = await supabase
    .from('org_branding')
    .upsert({ org_id: orgId, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'org_id' })
    .select('*')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  logAudit({
    org_id: orgId,
    actor_id: actorId,
    action: 'branding.updated',
    resource_type: 'org_branding',
    resource_id: data?.id ?? orgId,
    meta: updates,
  })

  return NextResponse.json({ data })
}
