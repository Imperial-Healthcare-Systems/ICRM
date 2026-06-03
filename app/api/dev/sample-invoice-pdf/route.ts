/**
 * Dev-only route — generate three sample tax invoice PDFs to verify the
 * Phase 6 rebuild.
 *
 *   GET /api/dev/sample-invoice-pdf?type=intra  → CGST + SGST split (Haryana → Haryana)
 *   GET /api/dev/sample-invoice-pdf?type=inter  → IGST single (Haryana → Karnataka)
 *   GET /api/dev/sample-invoice-pdf?type=b2c    → B2C (no buyer GSTIN, intra-state at seller)
 *
 * No database writes. Builds InvoicePdfData synthetically and returns
 * the resulting PDF binary. 404 in production.
 */
import { NextRequest, NextResponse } from 'next/server'
import { buildInvoicePdf, type InvoicePdfData } from '@/lib/invoice-pdf'

const IS_PROD = process.env.NODE_ENV === 'production'

const SELLER = {
  name: 'Imperial Tech Innovations',
  legal_name: 'Imperial Healthcare Systems Pvt Ltd',
  gstin: '06AAICI5025Q1Z6',
  cin: 'U62099HR2025PTC137921',
  phone: '+91 11 4567 8901',
  email: 'billing@imperialhealthcare.cloud',
  website: 'imperialcrm.cloud',
  address: 'Plot 45, Industrial Area, Phase II, Gurugram, Haryana 122001, India',
  state: 'Haryana',
  state_code: '06',
} as const

const LINE_ITEMS = [
  { description: 'Imperial CRM Cloud — Growth tier subscription (3 seats)', hsn: '998313', qty: 1, rate: '8999.00', total: '8999.00' },
  { description: 'AI Credits top-up: 10,000 credits (Imperial Intelligence)', hsn: '998313', qty: 1, rate: '1499.00', total: '1499.00' },
  { description: 'Implementation consulting — 2 hrs onboarding', hsn: '998313', qty: 2, rate: '1234.56', total: '2469.12' },
] as const

function buildSample(type: 'intra' | 'inter' | 'b2c' | 'verify' | 'verify-intra'): InvoicePdfData {
  // 'verify' reproduces the bug report scenario exactly so the fixes
  // can be eyeballed against the known-good expected values.
  // Buyer Ajay M A with Karnataka address (state code 29). GSTIN starts
  // with '32' (Kerala) — that's the bug report's wording. Inter-state
  // regardless because seller is 06 (Haryana). IGST 18%.
  //
  // Critically: all three tax-split amounts are LEFT AS 0 so the
  // PDF's derivation fallback (Round-2 BUG 1 fix) is exercised.
  // buyer_address is set so the new BILL TO renderer (Round-2 BUG 3
  // fix) has data to display.
  if (type === 'verify') {
    return {
      invoice_number: 'INV-VERIFY-AJAY',
      status: 'paid',
      issue_date: '2026-05-28',
      due_date: '2026-06-02',
      paid_date: '2026-05-28',
      items: [
        // Form-style item with `amount` field that DELIBERATELY does NOT
        // equal qty × rate (the BUG 2 trap). normalizeLineItems must
        // ignore `amount` and compute taxable = qty × rate.
        { description: 'Ignite', hsn: '998313', qty: 1, rate: '3349.00', amount: '0' },
      ],
      subtotal: '3349.00',
      tax_pct: 18,
      total: '3951.82',
      paid_amount: '3951.82',
      currency: 'INR',
      notes: null,
      terms: null,
      // All zero — forces the PDF-time derivation fallback to compute
      // and render the IGST 18% row.
      cgst_amount: '0',
      sgst_amount: '0',
      igst_amount: '0',
      buyer_name: 'Indiranagar Wellness Pvt Ltd',
      buyer_contact_name: 'Ajay M A',
      buyer_contact_phone: '+91 98765 43210',
      buyer_gstin: '32AANFL2294C1ZH',
      buyer_address: {
        line1: '123 MG Road, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        country: 'India',
      },
      buyer_state: 'Karnataka',
      buyer_state_code: '29',
      seller_state_code: SELLER.state_code,
      place_of_supply: 'Karnataka (29)',
      organisation: SELLER,
      hide_watermark: false,
      account_fallback: null,
      payments: [
        {
          amount: '1674.50',
          payment_method: 'online',
          reference: '5673597120',
          paid_at: '2026-05-28',
          paid_by: 'Imperial Healthcare Admin',
        },
        {
          amount: '2277.32',
          payment_method: 'bank_transfer',
          reference: 'YES0N6153180594100',
          paid_at: '2026-06-02',
          paid_by: 'Imperial Healthcare Admin',
        },
      ],
    }
  }

  // 'verify-intra' — buyer in Haryana (same as seller) so the derivation
  // fallback must split into CGST 9% + SGST 9% instead of IGST.
  if (type === 'verify-intra') {
    return {
      invoice_number: 'INV-VERIFY-INTRA',
      status: 'sent',
      issue_date: '2026-05-28',
      due_date: '2026-06-12',
      paid_date: null,
      items: [
        { description: 'Ignite', hsn: '998313', qty: 1, rate: '3349.00', amount: '0' },
      ],
      subtotal: '3349.00',
      tax_pct: 18,
      total: '3951.82',
      paid_amount: '0',
      currency: 'INR',
      notes: null,
      terms: null,
      cgst_amount: '0',
      sgst_amount: '0',
      igst_amount: '0',
      buyer_name: 'Gurgaon Buyer Pvt Ltd',
      buyer_gstin: '06AABCG1234D1Z5',
      buyer_address: {
        line1: 'Plot 12, Sector 18',
        line2: 'Udyog Vihar Phase IV',
        city: 'Gurugram',
        state: 'Haryana',
        pincode: '122016',
        country: 'India',
      },
      buyer_state: 'Haryana',
      buyer_state_code: '06',
      seller_state_code: SELLER.state_code,
      place_of_supply: 'Haryana (06)',
      organisation: SELLER,
      hide_watermark: false,
      account_fallback: null,
    }
  }

  const subtotal = 8999 + 1499 + 2469.12 // 12,967.12
  const taxPct = 18

  // Tax split per type
  let cgst = 0, sgst = 0, igst = 0
  if (type === 'intra' || type === 'b2c') {
    const total = subtotal * (taxPct / 100)
    cgst = Math.round(total * 50) / 100  // half, 2dp
    sgst = Math.round(total * 50) / 100
  } else {
    igst = Math.round(subtotal * taxPct) / 100
  }

  const totalTax = cgst + sgst + igst
  const grandTotal = subtotal + totalTax

  const isInter = type === 'inter'

  return {
    invoice_number: `INV-SAMPLE-${type.toUpperCase()}`,
    status: 'sent',
    issue_date: '2026-06-02',
    due_date: '2026-06-16',
    paid_date: null,
    items: LINE_ITEMS as unknown as InvoicePdfData['items'],
    subtotal: subtotal.toFixed(2),
    tax_pct: taxPct,
    total: grandTotal.toFixed(2),
    paid_amount: 0,
    currency: 'INR',
    notes: 'Thank you for your business. Please reference the invoice number on any payment.',
    terms: 'Payment is due within 15 days of invoice date. Late payments may incur a 1.5% monthly interest charge. Bank: HDFC Bank · A/C: 50100123456789 · IFSC: HDFC0000123',
    cgst_amount: cgst.toFixed(2),
    sgst_amount: sgst.toFixed(2),
    igst_amount: igst.toFixed(2),
    buyer_name:
      type === 'intra' ? 'Gurgaon Foods Pvt Ltd'
      : isInter      ? 'BangaloreTech Solutions Pvt Ltd'
      :                'Rajesh Kumar',
    buyer_gstin:
      type === 'intra' ? '06AABCG1234D1Z5'
      : isInter      ? '29AABCB1234E1Z9'
      :                null,
    buyer_address: type === 'b2c'
      ? { line1: 'Flat 42, Block C, Royal Heights', city: 'Faridabad', state: 'Haryana', pincode: '121002', country: 'India' }
      : type === 'intra'
      ? { line1: 'Plot 12, Sector 18', line2: 'Udyog Vihar Phase IV', city: 'Gurugram', state: 'Haryana', pincode: '122016', country: 'India' }
      : { line1: 'Tower B, Cyber City', line2: '5th Floor, Outer Ring Road', city: 'Bangalore', state: 'Karnataka', pincode: '560103', country: 'India' },
    buyer_state:
      type === 'intra' ? 'Haryana'
      : isInter      ? 'Karnataka'
      :                'Haryana',
    buyer_state_code:
      type === 'intra' ? '06'
      : isInter      ? '29'
      :                null,  // B2C: not captured
    seller_state_code: SELLER.state_code,
    place_of_supply:
      type === 'intra' ? 'Haryana (06)'
      : isInter      ? 'Karnataka (29)'
      :                'Haryana (06)',
    organisation: SELLER,
    hide_watermark: false,
    account_fallback: null,
  }
}

export async function GET(req: NextRequest) {
  if (IS_PROD) return new NextResponse(null, { status: 404 })

  const type = (new URL(req.url).searchParams.get('type') ?? 'intra').toLowerCase()
  if (!['intra', 'inter', 'b2c', 'verify', 'verify-intra'].includes(type)) {
    return NextResponse.json({ error: 'type must be intra | inter | b2c | verify | verify-intra' }, { status: 400 })
  }

  const data = buildSample(type as 'intra' | 'inter' | 'b2c' | 'verify' | 'verify-intra')
  const pdf = buildInvoicePdf(data)

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="sample-tax-invoice-${type}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
