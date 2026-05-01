import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { checkMutationLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'

const ALLOWED_STATUS = ['new', 'contacted', 'qualified', 'unqualified', 'converted', 'recycled']
const ALLOWED_RATING = ['hot', 'warm', 'cold']
const MAX_ROWS = 1000

type LeadRow = {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  company?: string
  job_title?: string
  lead_source?: string
  lead_status?: string
  rating?: string
  notes?: string
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: actorId } = session!.user

  const limit = await checkMutationLimit(orgId)
  if (!limit.success) return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })

  let body: { leads?: LeadRow[] }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const leads = body.leads ?? []
  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: 'No leads provided.' }, { status: 400 })
  }
  if (leads.length > MAX_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_ROWS} leads per upload.` }, { status: 400 })
  }

  const valid: object[] = []
  const errors: { row: number; message: string }[] = []

  leads.forEach((raw, i) => {
    const rowNum = i + 2 // CSV row number (header is row 1)
    const first_name = raw.first_name?.toString().trim()
    if (!first_name) {
      errors.push({ row: rowNum, message: 'first_name is required' })
      return
    }
    const lead_status = raw.lead_status?.toString().trim().toLowerCase() || 'new'
    if (!ALLOWED_STATUS.includes(lead_status)) {
      errors.push({ row: rowNum, message: `Invalid lead_status "${raw.lead_status}". Allowed: ${ALLOWED_STATUS.join(', ')}` })
      return
    }
    const rating = raw.rating?.toString().trim().toLowerCase() || 'warm'
    if (!ALLOWED_RATING.includes(rating)) {
      errors.push({ row: rowNum, message: `Invalid rating "${raw.rating}". Allowed: ${ALLOWED_RATING.join(', ')}` })
      return
    }
    valid.push({
      org_id: orgId,
      first_name,
      last_name: raw.last_name?.toString().trim() || null,
      email: raw.email?.toString().trim().toLowerCase() || null,
      phone: raw.phone?.toString().trim() || null,
      company: raw.company?.toString().trim() || null,
      job_title: raw.job_title?.toString().trim() || null,
      lead_source: raw.lead_source?.toString().trim() || null,
      lead_status,
      rating,
      notes: raw.notes?.toString().trim() || null,
      created_by: actorId,
    })
  })

  let inserted = 0
  if (valid.length) {
    // Insert in chunks of 100 to avoid PostgREST payload limits
    const CHUNK = 100
    for (let i = 0; i < valid.length; i += CHUNK) {
      const slice = valid.slice(i, i + CHUNK)
      const { data, error: dbError } = await supabaseAdmin.from('crm_leads').insert(slice).select('id')
      if (dbError) {
        errors.push({ row: -1, message: `Batch insert failed at chunk ${i}: ${dbError.message}` })
      } else {
        inserted += data?.length ?? 0
      }
    }
  }

  logAudit({
    org_id: orgId, actor_id: actorId, action: 'leads.bulk_upload',
    resource_type: 'crm_lead', resource_id: orgId,
    meta: { received: leads.length, inserted, failed: errors.length },
  })

  return NextResponse.json({ inserted, failed: errors.length, errors: errors.slice(0, 50) })
}
