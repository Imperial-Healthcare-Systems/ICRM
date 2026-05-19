import { NextRequest, NextResponse } from 'next/server'
import { getTenantClient, requireWriteAccess } from '@/lib/session'
import { logAudit } from '@/lib/audit'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { session, supabase, error } = await getTenantClient()
  if (error) return error
  const { orgId } = session.user
  const { id } = await params
  const { data, error: dbErr } = await supabase
    .from('crm_documents')
    .select(`*, crm_accounts(name), crm_contacts(first_name,last_name), crm_users!uploaded_by(full_name)`)
    .eq('id', id).eq('org_id', orgId).single()
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { session, supabase, error } = await requireWriteAccess()
  if (error) return error
  const { orgId, id: userId } = session.user
  const { id } = await params
  const { error: dbErr } = await supabase.from('crm_documents')
    .delete().eq('id', id).eq('org_id', orgId)
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  await logAudit({ org_id: orgId, actor_id: userId, action: 'delete', resource_type: 'document', resource_id: id })
  return NextResponse.json({ success: true })
}
