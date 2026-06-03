/**
 * Indian GST-compliant Tax Invoice PDF — A4, single template.
 *
 * Replaces the prior "INVOICE" cosmetic PDF. Renders every element a
 * tax invoice must carry under CGST Rule 46:
 *   - "TAX INVOICE" heading
 *   - Seller name, address, GSTIN, CIN, contact
 *   - Buyer name, address, GSTIN, state + state code
 *   - Invoice number, date, due date, place of supply
 *   - Line items with HSN/SAC, qty, rate, taxable value
 *   - Tax columns adapt: CGST+SGST (intra-state) OR IGST (inter-state)
 *   - Taxable subtotal, tax totals, grand total
 *   - Amount in words (Indian numbering)
 *   - "Computer-generated invoice" line
 *   - Spec-compliant watermark from lib/branding-constants
 *
 * Buyer/seller details come from snapshot columns on crm_invoices set
 * at issue time (M121). For pre-snapshot historical invoices, falls
 * back to a live join on crm_accounts so old PDFs still render.
 */
import { jsPDF } from 'jspdf'
import {
  formatINRPlain, amountInWords, toDecimal, multiply,
  determineGstSplit, stateCodeFromGstin, formatPlaceOfSupply,
  type MoneyInput,
} from '@/lib/money'
import { WATERMARK_LINES, LEGAL_SELLER_LINE } from '@/lib/branding-constants'

export type InvoiceLineItem = {
  description: string
  hsn?: string | null         // HSN (goods) / SAC (services) code
  qty: number | string
  rate: number | string
  /** Pre-tax line value (qty × rate − line discount). Computed by normalizeLineItems if missing. */
  taxable?: number | string
  /** Legacy alias for `taxable` — written by the existing LineItemsEditor form. */
  amount?: number | string
  /** Legacy alias for `taxable` — written by older callers. */
  total?: number | string
  /** Per-line discount percentage (0-100). Optional. */
  discount_pct?: number | string
}

/**
 * Format a money value for inclusion in the PDF. jsPDF's Standard 14
 * fonts (Helvetica/Times/Courier) do NOT contain the Unicode Rupee sign
 * U+20B9 (₹) — the renderer substitutes ¹ (U+00B9, same low byte). To
 * keep PDFs legible without embedding a custom font, prefix every
 * currency value with the ASCII string "Rs." instead.
 *
 * THIS HELPER IS PDF-ONLY. The web UI, emails, and API responses keep
 * using `formatINR()` from lib/money.ts which renders the proper ₹.
 */
function formatPDFCurrency(value: MoneyInput): string {
  return `Rs.${formatINRPlain(value)}`
}

/**
 * Normalize the line items array so every item has an explicit
 * `taxable` value before any PDF rendering reads it.
 *
 * ALWAYS computes from primitives:
 *   taxable = (qty × rate) − (qty × rate × discount_pct / 100)
 *
 * Pre-set `taxable`/`amount`/`total` fields on the input are IGNORED.
 * This makes the PDF immune to upstream callers that may write
 * inconsistent `amount` values (e.g. amount = rate instead of qty×rate).
 * Cost is negligible — one Decimal multiplication per row.
 *
 * Returns NEW objects; does not mutate the input.
 */
export function normalizeLineItems(items: InvoiceLineItem[]): InvoiceLineItem[] {
  return items.map(li => {
    const base = multiply(li.qty, li.rate)
    const disc = li.discount_pct
      ? base.times(toDecimal(li.discount_pct).dividedBy(100))
      : toDecimal(0)
    const taxable = base.minus(disc).toFixed(2)
    return { ...li, taxable }
  })
}

/** One row in the invoice's payment ledger (crm_invoice_payments). */
export type InvoicePaymentRow = {
  amount: number | string
  payment_method: string | null
  reference: string | null
  paid_at: string | null
  paid_by: string | null
}

export type InvoicePdfData = {
  invoice_number: string
  status: string
  issue_date: string
  due_date: string | null
  paid_date: string | null
  items: InvoiceLineItem[]
  /** Optional payment history. When empty/missing, the section is omitted. */
  payments?: InvoicePaymentRow[]
  subtotal: number | string
  tax_pct: number | string
  total: number | string
  paid_amount: number | string
  currency: string
  notes: string | null
  terms: string | null
  // Tax split (M121)
  cgst_amount: number | string
  sgst_amount: number | string
  igst_amount: number | string
  // Buyer snapshot (M121) — falls back to account live-join for historical rows
  buyer_name: string | null
  buyer_gstin: string | null
  buyer_address: {
    line1?: string | null; line2?: string | null;
    city?: string | null; state?: string | null;
    pincode?: string | null; country?: string | null;
  } | null
  buyer_state: string | null
  buyer_state_code: string | null
  // Seller context
  seller_state_code: string | null
  place_of_supply: string | null
  organisation: {
    name: string
    legal_name?: string | null   // overrides org.name on the PDF if set
    gstin?: string | null
    cin?: string | null
    pan?: string | null
    phone?: string | null
    email?: string | null
    website?: string | null
    address?: string | null
    state?: string | null
    state_code?: string | null
    logo_url?: string | null
  }
  // Branding hint — if true, the watermark line is suppressed (white-label)
  hide_watermark?: boolean
  // Optional account fallback for old invoices without snapshot
  account_fallback?: { name: string; gstin?: string | null; billing_address?: Record<string, unknown> | null } | null
}

// ── Brand palette (matches IMPERIAL_TENANT_SPEC §17 colour reference) ──
const NAVY:   [number, number, number] = [13, 42, 74]    // #0D2A4A
const BLUE:   [number, number, number] = [21, 101, 192]  // #1565C0
const ORANGE: [number, number, number] = [243, 140, 20]  // #F38C14
const SLATE_900: [number, number, number] = [15, 23, 42]
const SLATE_600: [number, number, number] = [71, 85, 105]
const SLATE_400: [number, number, number] = [148, 163, 184]
const SLATE_200: [number, number, number] = [226, 232, 240]
const WHITE: [number, number, number] = [255, 255, 255]
const MUTED_GRAY: [number, number, number] = [107, 114, 128] // #6B7280 — for inline secondary text in the FROM block

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function joinNonEmpty(parts: Array<string | null | undefined>, sep = ', '): string {
  return parts.filter(p => p && String(p).trim().length > 0).join(sep)
}

/** Compose a multi-line address from the snapshot blob. */
function formatBuyerAddress(addr: InvoicePdfData['buyer_address']): string[] {
  if (!addr) return []
  const lines: string[] = []
  if (addr.line1) lines.push(String(addr.line1))
  if (addr.line2) lines.push(String(addr.line2))
  const cityLine = joinNonEmpty([addr.city, joinNonEmpty([addr.state, addr.pincode], ' ')])
  if (cityLine) lines.push(cityLine)
  if (addr.country) lines.push(String(addr.country))
  return lines
}

// ─────────────────────────────────────────────────────────────────────
//  Main builder
// ─────────────────────────────────────────────────────────────────────

export function buildInvoicePdf(data: InvoicePdfData): Uint8Array {
  // Defensive normalisation — every line item must have an explicit
  // `taxable` field before the render loop reads it. Idempotent.
  const items = normalizeLineItems(data.items ?? [])

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const PAGE_W = doc.internal.pageSize.getWidth()    // 595
  const PAGE_H = doc.internal.pageSize.getHeight()   // 842
  const MARGIN_X = 36
  const CONTENT_W = PAGE_W - MARGIN_X * 2

  // ── Header band ───────────────────────────────────────────────────
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, PAGE_W, 100, 'F')
  doc.setFillColor(...ORANGE)
  doc.rect(0, 100, PAGE_W, 3, 'F')

  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('TAX INVOICE', MARGIN_X, 42)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const sellerLegalName = data.organisation.legal_name ?? 'Imperial Healthcare Systems Pvt Ltd'
  doc.text(sellerLegalName, MARGIN_X, 62)

  // Right side: invoice number, dates, place of supply
  const rightX = PAGE_W - MARGIN_X
  doc.setFontSize(8)
  doc.setTextColor(...SLATE_200)
  doc.text('INVOICE NO.', rightX, 32, { align: 'right' })
  doc.text('ISSUE DATE',  rightX - 110, 32, { align: 'right' })
  doc.text('DUE DATE',    rightX - 220, 32, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...WHITE)
  doc.text(data.invoice_number, rightX, 48, { align: 'right' })
  doc.text(fmtDate(data.issue_date), rightX - 110, 48, { align: 'right' })
  doc.text(fmtDate(data.due_date), rightX - 220, 48, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...SLATE_200)
  doc.text('PLACE OF SUPPLY', rightX, 70, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...WHITE)
  // Derive Place of Supply when the stored snapshot is missing
  // (pre-Phase-5 invoices). Priority:
  //   1. data.place_of_supply (snapshot)
  //   2. data.buyer_state_code (snapshot or M120 structured address fallback)
  //   3. first 2 chars of the buyer's GSTIN
  //   4. "—"
  const effectivePosCode =
    data.buyer_state_code ?? stateCodeFromGstin(data.buyer_gstin) ?? null
  const effectivePos =
    data.place_of_supply ?? (effectivePosCode ? formatPlaceOfSupply(effectivePosCode) : '—')
  doc.text(effectivePos, rightX, 86, { align: 'right' })

  let y = 130

  // ── Seller (FROM) and Buyer (BILL TO) blocks ──────────────────────
  const colW = (CONTENT_W - 24) / 2
  const fromX = MARGIN_X
  const billX = MARGIN_X + colW + 24

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...SLATE_400)
  doc.text('FROM',    fromX, y)
  doc.text('BILL TO', billX, y)
  y += 14

  // FROM block — brand name + legal-entity disclaimer
  // Primary line is the brand ("Imperial Tech Innovations"). The legal
  // entity that issues the invoice stays in the header band + footer;
  // here we surface the operating brand customers recognise.
  let fromY = y
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Imperial Tech Innovations', fromX, fromY)
  fromY += 13

  // Brand disclaimer immediately below, in muted gray, regular weight.
  // 9pt, wraps within the column if needed.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED_GRAY)
  const disclaimerLines = doc.splitTextToSize(
    'A technology brand of Imperial Healthcare Systems Pvt. Ltd.',
    colW,
  )
  doc.text(disclaimerLines, fromX, fromY)
  fromY += disclaimerLines.length * 11 + 4

  // Restore the FROM block's remaining-content styling (address, GSTIN, CIN, contact).
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SLATE_600)
  if (data.organisation.address) {
    const addrLines = doc.splitTextToSize(data.organisation.address, colW)
    doc.text(addrLines, fromX, fromY)
    fromY += addrLines.length * 11
  }
  if (data.organisation.gstin) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(`GSTIN: ${data.organisation.gstin}`, fromX, fromY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...SLATE_600)
    fromY += 11
  }
  if (data.organisation.cin) {
    doc.text(`CIN: ${data.organisation.cin}`, fromX, fromY)
    fromY += 11
  }
  const sellerContact = joinNonEmpty([data.organisation.phone, data.organisation.email, data.organisation.website], '  ·  ')
  if (sellerContact) {
    const contactLines = doc.splitTextToSize(sellerContact, colW)
    doc.text(contactLines, fromX, fromY)
    fromY += contactLines.length * 11
  }

  // ── BILL TO block — spec-compliant order ──────────────────────────
  // Line 1: name (bold)
  // Line 2: address_line1  (or "Address not provided" placeholder)
  // Line 3: address_line2  (omit if empty)
  // Line 4: "city, state – pincode"
  // Line 5: country (omit if India when seller is India too)
  // Line 6: "GSTIN: …"  (or italic "Not registered (B2C)" if absent)
  let toY = y
  const buyerName = data.buyer_name ?? data.account_fallback?.name ?? '—'
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(buyerName, billX, toY)
  toY += 14
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SLATE_600)

  // Decide what address content (if any) is available.
  const addr = data.buyer_address
  const fb = data.account_fallback?.billing_address as Record<string, unknown> | undefined
  const line1 = addr?.line1 ?? (fb?.line1 as string | undefined) ?? null
  const line2 = addr?.line2 ?? (fb?.line2 as string | undefined) ?? null
  const city =  addr?.city  ?? (fb?.city  as string | undefined) ?? null
  const state = addr?.state ?? (fb?.state as string | undefined) ?? data.buyer_state ?? null
  const pincode = addr?.pincode ?? (fb?.pincode as string | undefined) ?? null
  const country = addr?.country ?? (fb?.country as string | undefined) ?? null

  const anyAddrPart = !!(line1 || line2 || city || state || pincode)

  if (!anyAddrPart) {
    // Spec: render a placeholder in muted italic when nothing is available.
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...SLATE_400)
    doc.text('Address not provided', billX, toY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...SLATE_600)
    toY += 11
  } else {
    // Line 2 — address_line1 (placeholder if missing but other lines exist)
    if (line1) {
      const wrapped = doc.splitTextToSize(String(line1), colW) as string[]
      for (const w of wrapped) { doc.text(w, billX, toY); toY += 11 }
    } else {
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...SLATE_400)
      doc.text('Address line 1 not provided', billX, toY)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...SLATE_600)
      toY += 11
    }
    // Line 3 — address_line2 (omit if missing)
    if (line2) {
      const wrapped = doc.splitTextToSize(String(line2), colW) as string[]
      for (const w of wrapped) { doc.text(w, billX, toY); toY += 11 }
    }
    // Line 4 — "city, state – pincode" (only emit parts that exist)
    const stateWithCode = state
      ? (data.buyer_state_code ? `${state} (${data.buyer_state_code})` : String(state))
      : null
    const cityStatePart = joinNonEmpty([city, stateWithCode])
    const line4 = joinNonEmpty([cityStatePart, pincode], ' – ')
    if (line4) { doc.text(line4, billX, toY); toY += 11 }
    // Line 5 — country (omit if India and seller is India)
    const sellerIsIndia = !data.organisation.state_code || /^[0-3]\d$/.test(data.organisation.state_code)
    if (country && !(String(country).toLowerCase() === 'india' && sellerIsIndia)) {
      doc.text(String(country), billX, toY)
      toY += 11
    }
  }

  // Line 6 — GSTIN
  const buyerGstin = data.buyer_gstin ?? data.account_fallback?.gstin ?? null
  if (buyerGstin) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...NAVY)
    doc.text(`GSTIN: ${buyerGstin}`, billX, toY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...SLATE_600)
    toY += 11
  } else {
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...SLATE_400)
    doc.text('GSTIN: Not registered (B2C)', billX, toY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...SLATE_600)
    toY += 11
  }

  y = Math.max(fromY, toY) + 16

  // (The tech-brand disclosure now renders inside the FROM block,
  //  directly below the bold "Imperial Tech Innovations" primary
  //  name. No floating disclaimer here.)

  // ── Line items table ──────────────────────────────────────────────
  // Decide which tax columns to render based on the split.
  let cgstAmount = toDecimal(data.cgst_amount)
  let sgstAmount = toDecimal(data.sgst_amount)
  let igstAmount = toDecimal(data.igst_amount)
  const taxPct = toDecimal(data.tax_pct)
  const subtotalForSplit = toDecimal(data.subtotal)
  const totalForSplit = toDecimal(data.total)

  // ── Tax-split derivation fallback (BUG 1 fix) ─────────────────────
  // Pre-Phase-5 invoices were created before the create route stamped
  // cgst_amount/sgst_amount/igst_amount on the row. If the stored split
  // is all zeros but there's tax baked into total - subtotal, derive
  // the split at render time so the PDF stays compliant.
  //
  // Going-forward: new invoices have the split written at insert time,
  // so this fallback becomes a no-op. Worth a one-off backfill UPDATE
  // for historical rows once you confirm.
  if (cgstAmount.eq(0) && sgstAmount.eq(0) && igstAmount.eq(0)
      && taxPct.gt(0) && totalForSplit.gt(subtotalForSplit)) {
    // Resolve seller + buyer state codes from whatever's available.
    const sellerCode = data.seller_state_code
      ?? data.organisation.state_code
      ?? stateCodeFromGstin(data.organisation.gstin)
      ?? null
    const buyerCode = data.buyer_state_code
      ?? stateCodeFromGstin(data.buyer_gstin)
      ?? null
    const split = determineGstSplit(sellerCode, buyerCode, subtotalForSplit, taxPct)
    cgstAmount = split.cgst.toDecimalPlaces(2)
    sgstAmount = split.sgst.toDecimalPlaces(2)
    igstAmount = split.igst.toDecimalPlaces(2)
  }

  const isIntraState = cgstAmount.gt(0) && sgstAmount.gt(0)
  const isInterState = igstAmount.gt(0)
  const hasTax = isIntraState || isInterState

  // Column widths (sum = CONTENT_W). Tax columns adapt:
  //   intra-state: S.No(28) | Desc(190) | HSN(50) | Qty(34) | Rate(60) | Taxable(64) | CGST(48) | SGST(49)
  //   inter-state: S.No(28) | Desc(220) | HSN(50) | Qty(34) | Rate(60) | Taxable(64) | IGST(67)
  //   no-tax:      S.No(28) | Desc(280) | HSN(50) | Qty(34) | Rate(60) | Taxable(71)
  type Col = { key: string; label: string; w: number; align: 'left' | 'right' | 'center' }
  let cols: Col[]
  if (isIntraState) {
    cols = [
      { key: 'sno', label: '#', w: 28, align: 'center' },
      { key: 'desc', label: 'DESCRIPTION', w: 190, align: 'left' },
      { key: 'hsn', label: 'HSN/SAC', w: 50, align: 'center' },
      { key: 'qty', label: 'QTY', w: 34, align: 'right' },
      { key: 'rate', label: 'RATE', w: 60, align: 'right' },
      { key: 'taxable', label: 'TAXABLE', w: 64, align: 'right' },
      { key: 'cgst', label: `CGST ${taxPct.div(2).toFixed(0)}%`, w: 48, align: 'right' },
      { key: 'sgst', label: `SGST ${taxPct.div(2).toFixed(0)}%`, w: 49, align: 'right' },
    ]
  } else if (isInterState) {
    cols = [
      { key: 'sno', label: '#', w: 28, align: 'center' },
      { key: 'desc', label: 'DESCRIPTION', w: 220, align: 'left' },
      { key: 'hsn', label: 'HSN/SAC', w: 50, align: 'center' },
      { key: 'qty', label: 'QTY', w: 34, align: 'right' },
      { key: 'rate', label: 'RATE', w: 60, align: 'right' },
      { key: 'taxable', label: 'TAXABLE', w: 64, align: 'right' },
      { key: 'igst', label: `IGST ${taxPct.toFixed(0)}%`, w: 67, align: 'right' },
    ]
  } else {
    cols = [
      { key: 'sno', label: '#', w: 28, align: 'center' },
      { key: 'desc', label: 'DESCRIPTION', w: 280, align: 'left' },
      { key: 'hsn', label: 'HSN/SAC', w: 50, align: 'center' },
      { key: 'qty', label: 'QTY', w: 34, align: 'right' },
      { key: 'rate', label: 'RATE', w: 60, align: 'right' },
      { key: 'taxable', label: 'TAXABLE', w: 71, align: 'right' },
    ]
  }

  function drawTableHeader() {
    doc.setFillColor(...NAVY)
    doc.rect(MARGIN_X, y - 12, CONTENT_W, 20, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    let cx = MARGIN_X
    for (const col of cols) {
      const tx = col.align === 'right' ? cx + col.w - 4
        : col.align === 'center' ? cx + col.w / 2
        : cx + 6
      doc.text(col.label, tx, y, { align: col.align })
      cx += col.w
    }
    y += 16
  }

  drawTableHeader()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SLATE_900)

  // Per-line tax computation: divide the invoice-level tax in proportion
  // to line totals so the displayed per-line taxes reconcile to the total.
  const invoiceTax = isIntraState ? cgstAmount.plus(sgstAmount) : isInterState ? igstAmount : toDecimal(0)
  const subtotalD = toDecimal(data.subtotal)

  for (let i = 0; i < items.length; i++) {
    const li = items[i]
    // Single source of truth — normalised above. Never reach back into
    // the raw item shape (.total / .amount) here.
    const taxable = toDecimal(li.taxable)

    // Per-line tax = invoice-level tax × (line / subtotal). Avoid div-by-zero.
    const share = subtotalD.gt(0) ? taxable.div(subtotalD) : toDecimal(0)
    const lineTaxTotal = invoiceTax.times(share)
    const lineCgst = isIntraState ? lineTaxTotal.div(2) : toDecimal(0)
    const lineSgst = isIntraState ? lineTaxTotal.div(2) : toDecimal(0)
    const lineIgst = isInterState ? lineTaxTotal : toDecimal(0)

    // Wrap description; estimate row height
    const descCol = cols.find(c => c.key === 'desc')!
    const descLines = doc.splitTextToSize(li.description ?? '—', descCol.w - 8)
    const rowH = Math.max(14, descLines.length * 11 + 4)

    // Page break check
    if (y + rowH > PAGE_H - 120) {
      doc.addPage()
      y = 50
      drawTableHeader()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...SLATE_900)
    }

    // Alternating row background
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(MARGIN_X, y - 10, CONTENT_W, rowH, 'F')
    }

    let cx = MARGIN_X
    for (const col of cols) {
      const tx = col.align === 'right' ? cx + col.w - 4
        : col.align === 'center' ? cx + col.w / 2
        : cx + 6
      let value = ''
      switch (col.key) {
        case 'sno': value = String(i + 1); break
        case 'desc': value = ''; break  // drawn separately for wrap
        case 'hsn': value = li.hsn ?? '—'; break
        case 'qty': value = String(li.qty); break
        case 'rate': value = formatINRPlain(li.rate); break
        case 'taxable': value = formatINRPlain(taxable); break
        case 'cgst': value = formatINRPlain(lineCgst); break
        case 'sgst': value = formatINRPlain(lineSgst); break
        case 'igst': value = formatINRPlain(lineIgst); break
      }
      if (col.key === 'desc') {
        doc.text(descLines, cx + 6, y)
      } else {
        doc.text(value, tx, y, { align: col.align })
      }
      cx += col.w
    }

    // Row separator
    doc.setDrawColor(...SLATE_200)
    doc.line(MARGIN_X, y - 10 + rowH, MARGIN_X + CONTENT_W, y - 10 + rowH)
    y += rowH
  }

  y += 10

  // ── Totals stack (right-aligned) ──────────────────────────────────
  const totalsRightX = MARGIN_X + CONTENT_W
  const totalsLabelX = totalsRightX - 160
  const totalsValueX = totalsRightX - 4

  function totalsRow(label: string, value: string, opts: { bold?: boolean; color?: [number, number, number] } = {}) {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...(opts.color ?? SLATE_600))
    doc.text(label, totalsLabelX, y, { align: 'right' })
    doc.setTextColor(...(opts.color ?? SLATE_900))
    doc.text(value, totalsValueX, y, { align: 'right' })
    y += 16
  }

  totalsRow('Taxable Subtotal', formatPDFCurrency(data.subtotal))
  if (isIntraState) {
    totalsRow(`CGST (${taxPct.div(2).toFixed(2)}%)`, formatPDFCurrency(cgstAmount))
    totalsRow(`SGST (${taxPct.div(2).toFixed(2)}%)`, formatPDFCurrency(sgstAmount))
  } else if (isInterState) {
    totalsRow(`IGST (${taxPct.toFixed(2)}%)`, formatPDFCurrency(igstAmount))
  }

  // ── Grand total — emphasised band ─────────────────────────────────
  // BUG FIX (2B): the prior band started 16pt left of the label's right
  // edge, leaving ~60pt of the right-aligned "GRAND TOTAL" text outside
  // the navy fill — white-on-white, invisible. Anchor the band wide
  // enough that the full label sits on the navy fill, with consistent
  // 12pt padding around both label and value.
  y += 6
  const grandBandPaddingX = 12
  const grandBandLeft = totalsLabelX - 110   // wide enough for "GRAND TOTAL" at 11pt bold + padding
  const grandBandRight = totalsRightX + 4
  const grandBandWidth = grandBandRight - grandBandLeft
  const grandBandHeight = 28
  doc.setFillColor(...NAVY)
  doc.rect(grandBandLeft, y - 16, grandBandWidth, grandBandHeight, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  // Label: right-aligned at totalsLabelX, kept inside the band.
  doc.text('GRAND TOTAL', totalsLabelX, y + 2, { align: 'right' })
  // Value: right-aligned with explicit inner padding from band's right edge.
  doc.setFontSize(13)
  doc.text(formatPDFCurrency(data.total), grandBandRight - grandBandPaddingX, y + 2, { align: 'right' })
  y += 36

  // Paid + outstanding (if any payments recorded)
  const paid = toDecimal(data.paid_amount)
  if (paid.gt(0)) {
    totalsRow('Paid', `- ${formatPDFCurrency(paid)}`, { color: [34, 139, 34] })
    const outstanding = toDecimal(data.total).minus(paid)
    if (outstanding.gt(0)) {
      totalsRow('Amount Due', formatPDFCurrency(outstanding), { bold: true, color: ORANGE })
    } else {
      totalsRow('Status', 'Paid in Full', { bold: true, color: [34, 139, 34] })
    }
  }

  y += 18  // breathing room above the payment-history label

  // ── Payment history table (only if payments are recorded) ─────────
  // Renders one row per crm_invoice_payments entry. Same paginate-on-overflow
  // pattern as the line items table.
  const payments = data.payments ?? []
  if (payments.length > 0) {
    if (y > PAGE_H - 180) { doc.addPage(); y = 50 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...SLATE_400)
    doc.text(`PAYMENT HISTORY  (${payments.length})`, MARGIN_X, y)
    y += 18  // gap between label and the header band

    // Column layout with consistent inner padding.
    type PCol = { key: string; label: string; w: number; align: 'left' | 'right' | 'center' }
    const pCols: PCol[] = [
      { key: 'date',   label: 'DATE',      w: 80,  align: 'left' },
      { key: 'method', label: 'METHOD',    w: 80,  align: 'left' },
      { key: 'ref',    label: 'REFERENCE', w: 140, align: 'left' },
      { key: 'by',     label: 'PAID BY',   w: 130, align: 'left' },
      { key: 'amount', label: 'AMOUNT',    w: 93,  align: 'right' },
    ]
    const cellPadL = 8   // left cell padding
    const cellPadR = 8   // right cell padding

    // Header band (taller for breathing room)
    const headerBandH = 22
    doc.setFillColor(...NAVY)
    doc.rect(MARGIN_X, y - 14, CONTENT_W, headerBandH, 'F')
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    {
      let cx = MARGIN_X
      for (const c of pCols) {
        const tx = c.align === 'right' ? cx + c.w - cellPadR : cx + cellPadL
        doc.text(c.label, tx, y, { align: c.align })
        cx += c.w
      }
    }
    y += 18  // gap between header and first row

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...SLATE_900)
    const methodLabel: Record<string, string> = {
      bank_transfer: 'Bank Transfer',
      cash: 'Cash',
      cheque: 'Cheque',
      upi: 'UPI',
      card: 'Card',
      online: 'Online',
      other: 'Other',
    }

    const rowH = 18  // taller rows so text has vertical breathing room

    for (let i = 0; i < payments.length; i++) {
      const p = payments[i]
      if (y + rowH > PAGE_H - 120) { doc.addPage(); y = 50 }

      // Alternating row fill — sit slightly above text baseline for centered look
      if (i % 2 === 1) {
        doc.setFillColor(248, 250, 252)
        doc.rect(MARGIN_X, y - 12, CONTENT_W, rowH, 'F')
      }

      let cx = MARGIN_X
      for (const c of pCols) {
        const tx = c.align === 'right' ? cx + c.w - cellPadR : cx + cellPadL
        let value = ''
        switch (c.key) {
          case 'date':
            value = fmtDate(p.paid_at)
            break
          case 'method':
            value = p.payment_method ? (methodLabel[p.payment_method] ?? p.payment_method) : '—'
            break
          case 'ref': {
            // Truncate long references that would overflow the column.
            const ref = p.reference ?? '—'
            value = ref.length > 22 ? ref.slice(0, 20) + '…' : ref
            break
          }
          case 'by':
            value = p.paid_by ?? '—'
            break
          case 'amount':
            value = formatPDFCurrency(p.amount)
            break
        }
        doc.text(value, tx, y, { align: c.align })
        cx += c.w
      }
      doc.setDrawColor(...SLATE_200)
      doc.line(MARGIN_X, y - 12 + rowH, MARGIN_X + CONTENT_W, y - 12 + rowH)
      y += rowH
    }
    y += 22  // breathing room before the next section (Amount in Words)
  }

  // ── Amount in words ───────────────────────────────────────────────
  if (y > PAGE_H - 200) { doc.addPage(); y = 50 }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...SLATE_400)
  doc.text('AMOUNT IN WORDS', MARGIN_X, y)
  y += 12
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  doc.setTextColor(...NAVY)
  const wordsLines = doc.splitTextToSize(amountInWords(data.total, data.currency), CONTENT_W)
  doc.text(wordsLines, MARGIN_X, y)
  y += wordsLines.length * 12 + 12

  // ── Notes & terms ─────────────────────────────────────────────────
  function renderSection(title: string, body: string) {
    if (y > PAGE_H - 140) { doc.addPage(); y = 50 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...SLATE_400)
    doc.text(title, MARGIN_X, y)
    y += 12
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...SLATE_900)
    const lines = doc.splitTextToSize(body, CONTENT_W)
    doc.text(lines, MARGIN_X, y)
    y += lines.length * 12 + 12
  }
  if (data.notes) renderSection('NOTES', data.notes)
  if (data.terms) renderSection('TERMS & CONDITIONS', data.terms)

  // ── Footer: computer-generated line + watermark ───────────────────
  // Always place on the LAST page near the bottom.
  const totalPages = (doc as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    const footerY = PAGE_H - 60

    doc.setDrawColor(...SLATE_200)
    doc.line(MARGIN_X, footerY, PAGE_W - MARGIN_X, footerY)

    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...SLATE_400)
    doc.text(
      'This is a computer-generated invoice and does not require a signature.',
      PAGE_W / 2, footerY + 14, { align: 'center' },
    )

    doc.text(LEGAL_SELLER_LINE, PAGE_W / 2, footerY + 26, { align: 'center' })

    if (!data.hide_watermark) {
      doc.setTextColor(...BLUE)
      doc.text(WATERMARK_LINES.icrm, PAGE_W / 2, footerY + 38, { align: 'center' })
    }

    // Page number (right-aligned)
    doc.setTextColor(...SLATE_400)
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN_X, footerY + 50, { align: 'right' })
  }

  return new Uint8Array(doc.output('arraybuffer'))
}

// ─────────────────────────────────────────────────────────────────────
//  Data loader — read snapshot fields, fall back to live join
// ─────────────────────────────────────────────────────────────────────

export async function loadInvoiceForPdf(
  supabaseAdmin: import('@supabase/supabase-js').SupabaseClient,
  invoiceId: string,
  orgId: string | null,
): Promise<InvoicePdfData | null> {
  let query = supabaseAdmin
    .from('crm_invoices')
    .select(`
      invoice_number, status, issue_date, due_date, paid_date,
      items, subtotal, tax_pct, total, paid_amount, currency, notes, terms, org_id,
      buyer_name, buyer_gstin, buyer_address, buyer_state, buyer_state_code,
      seller_state_code, place_of_supply,
      cgst_amount, sgst_amount, igst_amount,
      crm_accounts!account_id(
        name, gstin, billing_address,
        billing_address_line1, billing_address_line2,
        billing_city, billing_state, billing_state_code,
        billing_pincode, billing_country
      )
    `)
    .eq('id', invoiceId)

  if (orgId) query = query.eq('org_id', orgId)

  type AccountRow = {
    name: string; gstin: string | null;
    billing_address: Record<string, unknown> | null;
    billing_address_line1: string | null; billing_address_line2: string | null;
    billing_city: string | null; billing_state: string | null;
    billing_state_code: string | null; billing_pincode: string | null;
    billing_country: string | null;
  }
  const { data: inv } = await query.single() as { data: {
    invoice_number: string; status: string; issue_date: string;
    due_date: string | null; paid_date: string | null;
    items: InvoiceLineItem[]; subtotal: string; tax_pct: string; total: string;
    paid_amount: string; currency: string; notes: string | null; terms: string | null;
    org_id: string;
    buyer_name: string | null; buyer_gstin: string | null; buyer_address: Record<string, unknown> | null;
    buyer_state: string | null; buyer_state_code: string | null;
    seller_state_code: string | null; place_of_supply: string | null;
    cgst_amount: string; sgst_amount: string; igst_amount: string;
    crm_accounts: AccountRow | AccountRow[] | null;
  } | null }
  if (!inv) return null

  const { data: org } = await supabaseAdmin
    .from('organisations')
    .select('name, gstin, pan, phone, email, website, address, state, state_code, logo_url, contact_phone, billing_email')
    .eq('id', inv.org_id)
    .single() as { data: {
      name: string; gstin: string | null; pan: string | null;
      phone: string | null; email: string | null; website: string | null;
      address: string | null; state: string | null; state_code: string | null;
      logo_url: string | null; contact_phone: string | null; billing_email: string | null;
    } | null }

  const account = Array.isArray(inv.crm_accounts) ? inv.crm_accounts[0] : inv.crm_accounts

  // Build buyer_address with fallback priority:
  //   1. Snapshot column on the invoice (Phase 5)
  //   2. Structured billing_* columns on the account (M120)
  //   3. Legacy JSONB billing_address on the account
  let resolvedBuyerAddress: InvoicePdfData['buyer_address'] =
    inv.buyer_address as InvoicePdfData['buyer_address']
  if (!resolvedBuyerAddress && account) {
    const anyStructured =
      account.billing_address_line1 || account.billing_address_line2 ||
      account.billing_city || account.billing_state ||
      account.billing_pincode || account.billing_country
    if (anyStructured) {
      resolvedBuyerAddress = {
        line1:   account.billing_address_line1,
        line2:   account.billing_address_line2,
        city:    account.billing_city,
        state:   account.billing_state,
        pincode: account.billing_pincode,
        country: account.billing_country,
      }
    }
  }

  // Buyer state + state_code with the same fallback chain.
  const resolvedBuyerState     = inv.buyer_state      ?? account?.billing_state      ?? null
  const resolvedBuyerStateCode = inv.buyer_state_code ?? account?.billing_state_code ?? null

  // ── Payment history ─────────────────────────────────────────────────
  // Fetched separately because it lives in crm_invoice_payments. Joined
  // with crm_users to get the recorder's full name. Sorted ascending so
  // the table reads chronologically (oldest payment first).
  const { data: paymentsRaw } = await supabaseAdmin
    .from('crm_invoice_payments')
    .select(`
      amount, payment_method, reference, paid_at,
      crm_users!created_by(full_name)
    `)
    .eq('invoice_id', invoiceId)
    .order('paid_at', { ascending: true }) as { data: Array<{
      amount: string; payment_method: string | null; reference: string | null;
      paid_at: string | null;
      crm_users: { full_name: string | null } | { full_name: string | null }[] | null;
    }> | null }

  const payments: InvoicePaymentRow[] = (paymentsRaw ?? []).map(p => {
    const u = Array.isArray(p.crm_users) ? p.crm_users[0] : p.crm_users
    return {
      amount: p.amount,
      payment_method: p.payment_method,
      reference: p.reference,
      paid_at: p.paid_at,
      paid_by: u?.full_name ?? null,
    }
  })

  return {
    invoice_number: inv.invoice_number,
    status: inv.status,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    paid_date: inv.paid_date,
    items: (inv.items ?? []) as InvoiceLineItem[],
    payments,
    subtotal: inv.subtotal,
    tax_pct: inv.tax_pct,
    total: inv.total,
    paid_amount: inv.paid_amount,
    currency: inv.currency ?? 'INR',
    notes: inv.notes,
    terms: inv.terms,
    cgst_amount: inv.cgst_amount ?? '0',
    sgst_amount: inv.sgst_amount ?? '0',
    igst_amount: inv.igst_amount ?? '0',
    buyer_name: inv.buyer_name ?? account?.name ?? null,
    buyer_gstin: inv.buyer_gstin ?? account?.gstin ?? null,
    buyer_address: resolvedBuyerAddress,
    buyer_state: resolvedBuyerState,
    buyer_state_code: resolvedBuyerStateCode,
    seller_state_code: inv.seller_state_code,
    place_of_supply: inv.place_of_supply,
    organisation: (() => {
      // Imperial-branded invoices get the canonical seller identity even
      // when the organisations row is sparsely populated (legacy seeds,
      // missing gstin/cin/state). For non-Imperial tenants, falls through
      // to whatever the org row provides.
      const isImperial = org?.name === 'Imperial Tech Innovations'
        || org?.gstin === '06AAICI5025Q1Z6'
      return {
        name: org?.name ?? 'Your Organisation',
        legal_name: isImperial ? 'Imperial Healthcare Systems Pvt Ltd' : org?.name,
        gstin: org?.gstin ?? (isImperial ? '06AAICI5025Q1Z6' : null),
        cin:   isImperial ? 'U62099HR2025PTC137921' : null,
        pan: org?.pan,
        phone: org?.phone ?? org?.contact_phone ?? null,
        email: org?.email ?? org?.billing_email ?? null,
        website: org?.website,
        address: org?.address,
        state: org?.state ?? (isImperial ? 'Haryana' : null),
        state_code: org?.state_code ?? (isImperial ? '06' : null),
        logo_url: org?.logo_url,
      }
    })(),
    account_fallback: account
      ? { name: account.name, gstin: account.gstin, billing_address: account.billing_address }
      : null,
  }
}
