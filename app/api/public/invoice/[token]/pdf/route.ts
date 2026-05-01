import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildInvoicePdf, loadInvoiceForPdf } from '@/lib/invoice-pdf'

/* Public PDF download by share token. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 32) return NextResponse.json({ error: 'Invalid token.' }, { status: 400 })

  const { data: lookup } = await supabaseAdmin
    .from('crm_invoices')
    .select('id')
    .eq('public_token', token)
    .single()

  if (!lookup) return NextResponse.json({ error: 'Invoice not found or link revoked.' }, { status: 404 })

  const data = await loadInvoiceForPdf(supabaseAdmin, lookup.id, null)
  if (!data) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })

  const pdf = buildInvoicePdf(data)
  return new NextResponse(new Blob([pdf as BlobPart], { type: 'application/pdf' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${data.invoice_number}.pdf"`,
      'Cache-Control': 'public, max-age=300',
    },
  })
}
