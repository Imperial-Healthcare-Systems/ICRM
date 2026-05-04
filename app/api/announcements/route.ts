import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkReadLimit, checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const CATEGORIES = ['general', 'feature', 'maintenance', 'policy', 'event', 'urgent']
const AUDIENCES = ['all', 'admins', 'sales', 'support', 'finance']

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const url = new URL(req.url)
  const activeOnly = url.searchParams.get('active') === 'true'

  let q = supabaseAdmin
    .from('crm_announcements')
    .select('*, crm_users!created_by(full_name)')
    .eq('org_id', orgId)
    .order('is_pinned', { ascending: false })
    .order('starts_at', { ascending: false })
    .limit(100)

  if (activeOnly) {
    const now = new Date().toISOString()
    q = q.lte('starts_at', now).or(`ends_at.is.null,ends_at.gte.${now}`)
  }

  const { data } = await q
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId, role } = session!.user
  if (!['super_admin', 'admin'].includes(role)) return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  if (!body.body?.trim()) return NextResponse.json({ error: 'Body is required.' }, { status: 400 })
  if (body.category && !CATEGORIES.includes(body.category)) return NextResponse.json({ error: 'Invalid category.' }, { status: 400 })
  if (body.audience && !AUDIENCES.includes(body.audience)) return NextResponse.json({ error: 'Invalid audience.' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin.from('crm_announcements').insert({
    org_id: orgId,
    title: body.title.trim(),
    body: body.body,
    category: body.category ?? 'general',
    audience: body.audience ?? 'all',
    is_pinned: body.is_pinned ?? false,
    starts_at: body.starts_at ?? new Date().toISOString(),
    ends_at: body.ends_at ?? null,
    created_by: actorId,
  }).select('id, title').single()

  if (dbErr || !data) return NextResponse.json({ error: dbErr?.message ?? 'Failed.' }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'announcement.created', resource_type: 'crm_announcement', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
