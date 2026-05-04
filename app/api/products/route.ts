import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkReadLimit, checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const limit = await checkReadLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const url = new URL(req.url)
  const search = url.searchParams.get('search')?.trim() ?? ''
  const activeOnly = url.searchParams.get('active') !== 'false'

  let q = supabaseAdmin
    .from('crm_products')
    .select('id, name, sku, description, unit_price, currency, tax_pct, category, unit, is_active, created_at', { count: 'exact' })
    .eq('org_id', orgId)
    .order('name')
    .limit(500)
  if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
  if (activeOnly) q = q.eq('is_active', true)

  const { data, count } = await q
  return NextResponse.json({ data: data ?? [], count: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user
  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
  if (!Number.isFinite(Number(body.unit_price)) || Number(body.unit_price) < 0)
    return NextResponse.json({ error: 'Unit price must be a non-negative number.' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin.from('crm_products').insert({
    org_id: orgId,
    name: body.name.trim(),
    sku: body.sku?.trim() || null,
    description: body.description ?? null,
    unit_price: Number(body.unit_price),
    currency: body.currency ?? 'INR',
    tax_pct: body.tax_pct != null ? Number(body.tax_pct) : 18,
    category: body.category?.trim() || null,
    unit: body.unit ?? 'unit',
    is_active: body.is_active ?? true,
    created_by: actorId,
  }).select('id, name').single()

  if (dbErr || !data) return NextResponse.json({ error: dbErr?.message ?? 'Failed to create.' }, { status: 500 })
  logAudit({ org_id: orgId, actor_id: actorId, action: 'product.created', resource_type: 'crm_product', resource_id: data.id })
  return NextResponse.json({ data }, { status: 201 })
}
