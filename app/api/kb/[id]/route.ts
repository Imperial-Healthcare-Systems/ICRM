import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient, requireWriteAccess } from '@/lib/session'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const ALLOWED = ['title', 'content', 'excerpt', 'category', 'tags', 'status', 'is_public', 'slug']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error
  const { orgId } = session.user
  const { id } = await params
  const { data } = await supabase.from('crm_kb_articles')
    .select('*, crm_users!author_id(id, full_name)')
    .eq('id', id).eq('org_id', orgId).single()
  if (!data) return NextResponse.json({ error: 'Article not found.' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: userId } = session.user
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const { id } = await params
  const body = await req.json()
  const updates: Record<string, unknown> = Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)))
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

  if (updates.status === 'published') {
    const { data: existing } = await supabase.from('crm_kb_articles').select('published_at').eq('id', id).single()
    if (!existing?.published_at) updates.published_at = new Date().toISOString()
  }

  const { data, error: dbErr } = await supabase.from('crm_kb_articles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', orgId)
    .select('id').single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Article not found.' }, { status: 404 })
  logAudit({ org_id: orgId, actor_id: userId, action: 'kb_article.updated', resource_type: 'crm_kb_article', resource_id: id, meta: updates })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: userId } = session.user
  const { id } = await params
  const { error: dbErr } = await supabase.from('crm_kb_articles').delete().eq('id', id).eq('org_id', orgId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: userId, action: 'kb_article.deleted', resource_type: 'crm_kb_article', resource_id: id })
  return NextResponse.json({ success: true })
}
