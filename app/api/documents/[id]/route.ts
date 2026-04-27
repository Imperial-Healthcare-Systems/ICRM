import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user
  const { id } = await params
  const { data, error: dbErr } = await supabaseAdmin
    .from('crm_documents')
    .select(`*, crm_accounts(name), crm_contacts(first_name,last_name), crm_users!uploaded_by(full_name)`)
    .eq('id', id).eq('org_id', orgId).single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId, id: userId } = session!.user
  const { id } = await params
  const { error: dbErr } = await supabaseAdmin.from('crm_documents')
    .delete().eq('id', id).eq('org_id', orgId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  await logAudit({ org_id: orgId, actor_id: userId, action: 'delete', resource_type: 'document', resource_id: id })
  return NextResponse.json({ success: true })
}
