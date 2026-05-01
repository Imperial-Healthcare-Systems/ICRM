import { jsPDF } from 'jspdf'

export type InvoicePdfData = {
  invoice_number: string
  status: string
  issue_date: string
  due_date: string | null
  paid_date: string | null
  items: Array<{ description: string; qty: number; rate: number; total: number }>
  subtotal: number
  tax_pct: number
  total: number
  paid_amount: number
  currency: string
  notes: string | null
  terms: string | null
  account: { name: string; email?: string | null; phone?: string | null; billing_address?: Record<string, unknown> | null } | null
  organisation: { name: string; gstin?: string | null; pan?: string | null; phone?: string | null; website?: string | null; address?: string | null; logo_url?: string | null }
}

const fmt = (n: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n ?? 0)

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

const ORANGE: [number, number, number] = [244, 121, 32]
const NAVY: [number, number, number] = [13, 27, 46]
const SLATE_400: [number, number, number] = [148, 163, 184]
const SLATE_700: [number, number, number] = [51, 65, 85]
const EMERALD: [number, number, number] = [16, 185, 129]
const RED: [number, number, number] = [239, 68, 68]

/** Generate an invoice PDF as a Uint8Array. Works in Node and browser. */
export function buildInvoicePdf(data: InvoicePdfData): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40
  let y = margin

  /* Header band */
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageWidth, 90, 'F')
  doc.setFillColor(...ORANGE)
  doc.rect(0, 86, pageWidth, 4, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(data.organisation.name, margin, 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const orgMeta = [data.organisation.address, data.organisation.phone, data.organisation.website].filter(Boolean).join(' · ')
  if (orgMeta) doc.text(orgMeta, margin, 56)
  if (data.organisation.gstin) doc.text(`GSTIN: ${data.organisation.gstin}`, margin, 70)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.text('INVOICE', pageWidth - margin, 38, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`# ${data.invoice_number}`, pageWidth - margin, 58, { align: 'right' })

  y = 120

  /* Status pill */
  const statusColor = data.status === 'paid' ? EMERALD : data.status === 'overdue' ? RED : SLATE_400
  doc.setFillColor(...statusColor)
  doc.roundedRect(pageWidth - margin - 70, y - 10, 70, 18, 8, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(data.status.toUpperCase(), pageWidth - margin - 35, y + 2, { align: 'center' })
  y += 20

  /* Bill-to + dates row */
  doc.setTextColor(...SLATE_400)
  doc.setFontSize(8)
  doc.text('BILL TO', margin, y)
  doc.text('ISSUE DATE', pageWidth / 2 - 20, y)
  doc.text('DUE DATE', pageWidth - margin - 80, y)
  y += 12

  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(data.account?.name ?? '—', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...SLATE_700)
  doc.text(fmtDate(data.issue_date), pageWidth / 2 - 20, y)
  doc.text(fmtDate(data.due_date), pageWidth - margin - 80, y)

  if (data.account?.email || data.account?.phone) {
    y += 14
    doc.setFontSize(9)
    doc.setTextColor(...SLATE_400)
    const contactLine = [data.account?.email, data.account?.phone].filter(Boolean).join(' · ')
    doc.text(contactLine, margin, y)
  }

  y += 30

  /* Line items table */
  const colX = { desc: margin, qty: pageWidth - margin - 220, rate: pageWidth - margin - 130, total: pageWidth - margin }

  doc.setFillColor(245, 247, 250)
  doc.rect(margin, y - 14, pageWidth - 2 * margin, 22, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...SLATE_400)
  doc.text('DESCRIPTION', colX.desc + 4, y)
  doc.text('QTY', colX.qty, y, { align: 'right' })
  doc.text('RATE', colX.rate, y, { align: 'right' })
  doc.text('AMOUNT', colX.total - 4, y, { align: 'right' })
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)

  for (const li of data.items) {
    if (y > 720) {
      doc.addPage()
      y = margin
    }
    const wrap = doc.splitTextToSize(li.description ?? '', colX.qty - colX.desc - 8)
    const lineHeight = Math.max(14, wrap.length * 12)
    doc.text(wrap, colX.desc + 4, y)
    doc.text(String(li.qty), colX.qty, y, { align: 'right' })
    doc.text(fmt(li.rate, data.currency), colX.rate, y, { align: 'right' })
    doc.text(fmt(li.total, data.currency), colX.total - 4, y, { align: 'right' })
    y += lineHeight
    doc.setDrawColor(230, 232, 240)
    doc.line(margin, y - 4, pageWidth - margin, y - 4)
  }

  y += 8

  /* Totals stack */
  const labelX = pageWidth - margin - 130
  const valueX = pageWidth - margin - 4
  const row = (label: string, value: string, opts: { bold?: boolean; color?: [number, number, number] } = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...(opts.color ?? SLATE_700))
    doc.text(label, labelX, y, { align: 'right' })
    doc.text(value, valueX, y, { align: 'right' })
    y += 14
  }

  row('Subtotal', fmt(data.subtotal, data.currency))
  if (data.tax_pct > 0) row(`Tax (${data.tax_pct}%)`, fmt(data.total - data.subtotal, data.currency))
  row('Total', fmt(data.total, data.currency), { bold: true, color: NAVY })
  if (data.paid_amount > 0) row('Paid', `- ${fmt(data.paid_amount, data.currency)}`, { color: EMERALD })

  const outstanding = Math.max(0, data.total - (data.paid_amount ?? 0))
  if (outstanding > 0) {
    y += 4
    doc.setFillColor(...ORANGE)
    doc.rect(labelX - 6, y - 12, valueX - labelX + 14, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('AMOUNT DUE', labelX, y + 2, { align: 'right' })
    doc.text(fmt(outstanding, data.currency), valueX, y + 2, { align: 'right' })
    y += 22
  } else if (data.paid_amount > 0) {
    y += 4
    doc.setFillColor(...EMERALD)
    doc.rect(labelX - 6, y - 12, valueX - labelX + 14, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('PAID IN FULL', labelX, y + 2, { align: 'right' })
    doc.text(fmtDate(data.paid_date), valueX, y + 2, { align: 'right' })
    y += 22
  }

  y += 24

  /* Notes & terms */
  if (data.notes) {
    if (y > 720) { doc.addPage(); y = margin }
    doc.setTextColor(...SLATE_400)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('NOTES', margin, y)
    y += 10
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...SLATE_700)
    const notesLines = doc.splitTextToSize(data.notes, pageWidth - 2 * margin)
    doc.text(notesLines, margin, y)
    y += notesLines.length * 12 + 12
  }

  if (data.terms) {
    if (y > 720) { doc.addPage(); y = margin }
    doc.setTextColor(...SLATE_400)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('TERMS & CONDITIONS', margin, y)
    y += 10
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...SLATE_700)
    const termsLines = doc.splitTextToSize(data.terms, pageWidth - 2 * margin)
    doc.text(termsLines, margin, y)
    y += termsLines.length * 12
  }

  /* Footer */
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setDrawColor(230, 232, 240)
  doc.line(margin, pageHeight - 50, pageWidth - margin, pageHeight - 50)
  doc.setTextColor(...SLATE_400)
  doc.setFontSize(8)
  doc.text(`Generated ${new Date().toLocaleDateString('en-IN')} · ${data.organisation.name}`, margin, pageHeight - 32)
  doc.text('Powered by Imperial CRM', pageWidth - margin, pageHeight - 32, { align: 'right' })

  return new Uint8Array(doc.output('arraybuffer'))
}

/** Fetch invoice + org + account from Supabase and shape into PDF data. */
export async function loadInvoiceForPdf(supabaseAdmin: import('@supabase/supabase-js').SupabaseClient, invoiceId: string, orgId: string | null): Promise<InvoicePdfData | null> {
  let query = supabaseAdmin
    .from('crm_invoices')
    .select(`
      invoice_number, status, issue_date, due_date, paid_date,
      items, subtotal, tax_pct, total, paid_amount, currency, notes, terms, org_id,
      crm_accounts!account_id(name, email, phone, billing_address)
    `)
    .eq('id', invoiceId)

  if (orgId) query = query.eq('org_id', orgId)

  const { data: inv } = await query.single()
  if (!inv) return null

  const { data: org } = await supabaseAdmin
    .from('organisations')
    .select('name, gstin, pan, phone, website, address, logo_url')
    .eq('id', inv.org_id)
    .single()

  const account = Array.isArray(inv.crm_accounts) ? inv.crm_accounts[0] : inv.crm_accounts

  return {
    invoice_number: inv.invoice_number,
    status: inv.status,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    paid_date: inv.paid_date,
    items: inv.items ?? [],
    subtotal: Number(inv.subtotal ?? 0),
    tax_pct: Number(inv.tax_pct ?? 0),
    total: Number(inv.total ?? 0),
    paid_amount: Number(inv.paid_amount ?? 0),
    currency: inv.currency ?? 'INR',
    notes: inv.notes,
    terms: inv.terms,
    account: account ? { name: account.name, email: account.email, phone: account.phone, billing_address: account.billing_address } : null,
    organisation: {
      name: org?.name ?? 'Your Organisation',
      gstin: org?.gstin,
      pan: org?.pan,
      phone: org?.phone,
      website: org?.website,
      address: org?.address,
      logo_url: org?.logo_url,
    },
  }
}
