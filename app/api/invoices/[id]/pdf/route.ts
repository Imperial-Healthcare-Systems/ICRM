import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireSession } from '@/lib/session'
import { buildInvoicePdf, loadInvoiceForPdf } from '@/lib/invoice-pdf'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession()
  if (error) return error
  const { orgId } = session!.user

  const { id } = await params
  const data = await loadInvoiceForPdf(supabaseAdmin, id, orgId)
  if (!data) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })

  const pdf = buildInvoicePdf(data)
  return new NextResponse(new Blob([pdf as BlobPart], { type: 'application/pdf' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${data.invoice_number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
