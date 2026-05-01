// Smoke-test the invoice PDF generator with a synthetic payload.
// Writes the result to /tmp/test-invoice.pdf so you can open it.
import { writeFileSync } from 'node:fs'
import { buildInvoicePdf } from '../lib/invoice-pdf.ts'

const data = {
  invoice_number: 'INV-9999',
  status: 'sent',
  issue_date: '2026-04-15',
  due_date: '2026-05-15',
  paid_date: null,
  items: [
    { description: 'Imperial CRM Enterprise Plan — Apr 2026', qty: 1, rate: 24999, total: 24999 },
    { description: 'Additional 50 AI credits', qty: 1, rate: 4500, total: 4500 },
    { description: 'Setup & onboarding fee', qty: 1, rate: 5000, total: 5000 },
  ],
  subtotal: 34499,
  tax_pct: 18,
  total: 40709,
  paid_amount: 10000,
  currency: 'INR',
  notes: 'Thank you for your business. Payment within 30 days please.',
  terms: 'Late payment attracts 1.5% monthly interest. Disputes must be raised within 7 days.',
  account: { name: 'Acme Healthcare Pvt Ltd', email: 'finance@acme.com', phone: '+91 98765 43210' },
  organisation: {
    name: 'Imperial Tech Innovations',
    gstin: '06AAICI5025Q1Z6',
    phone: '+91 73580 13585',
    website: 'imperialtechinnovations.com',
    address: 'M15, Welldone Tech Park, Sector 48, Gurugram',
  },
}

const pdf = buildInvoicePdf(data)
const out = process.env.TMPDIR ? `${process.env.TMPDIR}/test-invoice.pdf` : 'test-invoice.pdf'
writeFileSync(out, pdf)
console.log(`PASS — wrote ${pdf.length} bytes to ${out}`)
