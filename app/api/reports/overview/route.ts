import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

  const [
    invoicesMonth,
    invoicesLastMonth,
    dealsOpen,
    dealsWon,
    leadsNew,
    ticketsOpen,
    contacts,
  ] = await Promise.all([
    supabaseAdmin.from('crm_invoices').select('total').eq('org_id', orgId).eq('status', 'paid').gte('paid_date', startOfMonth),
    supabaseAdmin.from('crm_invoices').select('total').eq('org_id', orgId).eq('status', 'paid').gte('paid_date', startOfLastMonth).lte('paid_date', endOfLastMonth),
    supabaseAdmin.from('crm_deals').select('id', { count: 'exact', head: true }).eq('org_id', orgId).not('deal_status', 'in', '("won","lost")'),
    supabaseAdmin.from('crm_deals').select('deal_value').eq('org_id', orgId).eq('deal_status', 'won').gte('updated_at', startOfMonth),
    supabaseAdmin.from('crm_leads').select('id', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', startOfMonth),
    supabaseAdmin.from('crm_tickets').select('id', { count: 'exact', head: true }).eq('org_id', orgId).in('status', ['open', 'in_progress', 'waiting']),
    supabaseAdmin.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
  ])

  const revenueMonth = invoicesMonth.data?.reduce((s, r) => s + (r.total ?? 0), 0) ?? 0
  const revenueLastMonth = invoicesLastMonth.data?.reduce((s, r) => s + (r.total ?? 0), 0) ?? 0
  const revenueGrowth = revenueLastMonth > 0 ? ((revenueMonth - revenueLastMonth) / revenueLastMonth) * 100 : null
  const wonValue = dealsWon.data?.reduce((s, r) => s + (r.deal_value ?? 0), 0) ?? 0

  return NextResponse.json({
    revenueMonth,
    revenueGrowth,
    dealsOpen: dealsOpen.count ?? 0,
    dealsWonValue: wonValue,
    leadsNew: leadsNew.count ?? 0,
    ticketsOpen: ticketsOpen.count ?? 0,
    totalContacts: contacts.count ?? 0,
  })
}
