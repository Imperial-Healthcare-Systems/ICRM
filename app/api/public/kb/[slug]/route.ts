import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Public KB article fetch by slug. Optional ?org=<orgId> to disambiguate
 * across orgs (slugs are unique per-org). Increments view_count.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const orgId = new URL(req.url).searchParams.get('org')

  let q = supabaseAdmin
    .from('crm_kb_articles')
    .select('id, slug, title, content, excerpt, category, tags, view_count, helpful_count, unhelpful_count, published_at, org_id')
    .eq('slug', slug).eq('status', 'published').eq('is_public', true)
  if (orgId) q = q.eq('org_id', orgId)

  const { data: article } = await q.maybeSingle()
  if (!article) return NextResponse.json({ error: 'Article not found.' }, { status: 404 })

  // Bump view_count (fire-and-forget)
  await supabaseAdmin.from('crm_kb_articles').update({ view_count: (article.view_count ?? 0) + 1 }).eq('id', article.id)

  // Get org name for the brand strip
  const { data: org } = await supabaseAdmin.from('organisations').select('name, logo_url').eq('id', article.org_id).single()

  return NextResponse.json({ data: { ...article, organisation: org } })
}

/* POST: feedback (helpful / unhelpful) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await req.json().catch(() => ({}))
  const orgId = body.org_id

  const { data: article } = await supabaseAdmin
    .from('crm_kb_articles')
    .select('id, helpful_count, unhelpful_count')
    .eq('slug', slug).eq('status', 'published').eq('is_public', true)
    .eq('org_id', orgId)
    .maybeSingle()
  if (!article) return NextResponse.json({ error: 'Article not found.' }, { status: 404 })

  const updates: Record<string, number> = {}
  if (body.vote === 'helpful') updates.helpful_count = (article.helpful_count ?? 0) + 1
  else if (body.vote === 'unhelpful') updates.unhelpful_count = (article.unhelpful_count ?? 0) + 1
  else return NextResponse.json({ error: 'Invalid vote.' }, { status: 400 })

  await supabaseAdmin.from('crm_kb_articles').update(updates).eq('id', article.id)
  return NextResponse.json({ success: true })
}
