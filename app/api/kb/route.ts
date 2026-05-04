import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkReadLimit, checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const url = new URL(req.url)
  const search = url.searchParams.get('search')?.trim() ?? ''
  const status = url.searchParams.get('status') ?? ''

  let q = supabaseAdmin
    .from('crm_kb_articles')
    .select(`
      id, slug, title, excerpt, category, tags, status, is_public, view_count,
      published_at, created_at, updated_at,
      crm_users!author_id(id, full_name)
    `, { count: 'exact' })
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false })
    .limit(200)
  if (search) q = q.ilike('title', `%${search}%`)
  if (status) q = q.eq('status', status)

  const { data, count } = await q
  return NextResponse.json({ data: data ?? [], count: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required.' }, { status: 400 })
  if (!body.content?.trim()) return NextResponse.json({ error: 'Content is required.' }, { status: 400 })

  // Generate unique slug
  const baseSlug = body.slug?.trim() ? slugify(body.slug) : slugify(body.title)
  let slug = baseSlug || 'article'
  for (let i = 2; i < 50; i++) {
    const { data: clash } = await supabaseAdmin.from('crm_kb_articles').select('id').eq('org_id', orgId).eq('slug', slug).maybeSingle()
    if (!clash) break
    slug = `${baseSlug}-${i}`
  }

  const status = body.status ?? 'draft'

  const { data, error: dbErr } = await supabaseAdmin.from('crm_kb_articles').insert({
    org_id: orgId,
    slug,
    title: body.title.trim(),
    content: body.content,
    excerpt: body.excerpt ?? null,
    category: body.category ?? 'general',
    tags: body.tags ?? [],
    status,
    is_public: body.is_public ?? true,
    author_id: userId,
    published_at: status === 'published' ? new Date().toISOString() : null,
  }).select('id, slug, title').single()

  if (dbErr || !data) return NextResponse.json({ error: dbErr?.message ?? 'Failed to create.' }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: userId, action: 'kb_article.created', resource_type: 'crm_kb_article', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
