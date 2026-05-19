import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const result = await requireSession()
  if (result.error) return result.error
  const session = result.session
  if (!session.user.identityId) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { data: memberships } = await supabaseAdmin
    .from('memberships')
    .select(`
      id, role, status, hrms_access, crm_access,
      organisations!inner(id, name, plan_tier, subscription_status)
    `)
    .eq('identity_id', session.user.identityId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  const orgs = (memberships ?? []).map(m => {
    const org = Array.isArray(m.organisations) ? m.organisations[0] : m.organisations
    return {
      membership_id: m.id,
      membership_role: m.role,
      crm_access: m.crm_access,
      hrms_access: m.hrms_access,
      org_id: (org as { id: string })?.id,
      org_name: (org as { name: string })?.name,
      plan_tier: (org as { plan_tier: string })?.plan_tier,
      subscription_status: (org as { subscription_status: string })?.subscription_status,
      is_active: (org as { id: string })?.id === session.user.orgId,
    }
  })

  return NextResponse.json({ data: orgs })
}
