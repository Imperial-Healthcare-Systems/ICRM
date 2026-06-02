/**
 * Tests for the GST helpers added to lib/money.ts.
 *   - GSTIN format validation
 *   - state code derivation
 *   - intra-state vs inter-state CGST/SGST/IGST split
 *   - amountInWords for Indian numbering (lakhs/crores)
 *   - place-of-supply formatting
 *
 * Standalone — re-implements the helpers against decimal.js the same
 * way lib/money.ts does, then asserts.
 *
 * Usage: node scripts/gst-helpers-test.mjs
 */
import Decimal from 'decimal.js'

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP })

let passed = 0
let failed = 0

function assert(label, expected, actual) {
  const ok = String(expected) === String(actual)
  if (ok) { console.log(`  ✓ ${label}`); passed++ }
  else { console.log(`  ✗ ${label} — expected ${expected}, got ${actual}`); failed++ }
}

// ── Mirrors of lib/money.ts ─────────────────────────────────────────
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const isValidGstin = (g) => !!g && GSTIN_REGEX.test(g)
const stateCodeFromGstin = (g) => isValidGstin(g) ? g.slice(0, 2) : null

const toDecimal = (v) => v === null || v === undefined || v === '' ? new Decimal(0) : new Decimal(v)
const roundCurrency = (d) => toDecimal(d).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)

function determineGstSplit(sellerState, buyerState, base, taxPct) {
  const b = toDecimal(base)
  const rate = toDecimal(taxPct).dividedBy(100)
  const totalTax = b.times(rate)
  const eff = buyerState ?? sellerState ?? null
  if (sellerState && eff && sellerState === eff) {
    const half = totalTax.dividedBy(2)
    return { kind: 'intra', cgst: half, sgst: half, igst: new Decimal(0), totalTax }
  }
  return { kind: 'inter', cgst: new Decimal(0), sgst: new Decimal(0), igst: totalTax, totalTax }
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
function tw(n) { if (n === 0) return ''; if (n < 20) return ONES[n]; const t = Math.floor(n / 10), o = n % 10; return TENS[t] + (o ? ' ' + ONES[o] : '') }
function thw(n) { if (n === 0) return ''; const h = Math.floor(n / 100), r = n % 100; const p = []; if (h > 0) p.push(ONES[h] + ' Hundred'); if (r > 0) p.push(tw(r)); return p.join(' ') }
function intWords(n) {
  if (n === 0) return 'Zero'
  if (n < 0) return 'Negative ' + intWords(-n)
  const p = []
  const cr = Math.floor(n / 10000000); if (cr > 0) { p.push(intWords(cr) + ' Crore'); n %= 10000000 }
  const lk = Math.floor(n / 100000); if (lk > 0) { p.push(tw(lk) + ' Lakh'); n %= 100000 }
  const th = Math.floor(n / 1000); if (th > 0) { p.push(tw(th) + ' Thousand'); n %= 1000 }
  if (n > 0) p.push(thw(n))
  return p.join(' ').trim()
}
function amountInWords(value, currency = 'INR') {
  const r = roundCurrency(value), neg = r.isNegative(), abs = r.abs()
  const rup = abs.floor().toNumber(), pai = abs.minus(abs.floor()).times(100).round().toNumber()
  const name = currency === 'INR' ? 'Indian Rupees' : currency
  let out = `${name} ${intWords(rup)}`
  if (pai > 0) out += ` and ${tw(pai)} Paise`
  out += ' Only'
  return neg ? 'Negative ' + out : out
}

// ── TEST 1: GSTIN validation ───────────────────────────────────────
console.log('\nTEST 1 — GSTIN format validation')
{
  assert('Imperial GSTIN valid', true, isValidGstin('06AAICI5025Q1Z6'))
  // Format check only — checksum is out of scope per brief.
  assert("char-12 must be 'Z' (format violation)", false, isValidGstin('06AAICI5025Q1Y6'))
  assert('too short', false, isValidGstin('06AAICI5025Q1Z'))
  assert('lowercase rejected', false, isValidGstin('06aaici5025q1z6'))
  assert('NULL → false', false, isValidGstin(null))
  assert('empty → false', false, isValidGstin(''))
}

// ── TEST 2: state code from GSTIN ──────────────────────────────────
console.log('\nTEST 2 — state code derivation')
{
  assert("Imperial → '06' (Haryana)", '06', stateCodeFromGstin('06AAICI5025Q1Z6'))
  assert('invalid GSTIN → null', null, stateCodeFromGstin('garbage'))
}

// ── TEST 3: intra-state split (CGST + SGST) ────────────────────────
console.log('\nTEST 3 — intra-state: Haryana → Haryana, ₹1000 @ 18%')
{
  const r = determineGstSplit('06', '06', '1000.00', 18)
  assert("kind = 'intra'", 'intra', r.kind)
  assert('CGST = ₹90.00', '90.00', r.cgst.toFixed(2))
  assert('SGST = ₹90.00', '90.00', r.sgst.toFixed(2))
  assert('IGST = ₹0.00', '0.00', r.igst.toFixed(2))
  assert('total tax = ₹180.00', '180.00', r.totalTax.toFixed(2))
  assert('CGST + SGST = total tax', '180.00', r.cgst.plus(r.sgst).toFixed(2))
}

// ── TEST 4: inter-state split (IGST only) ──────────────────────────
console.log('\nTEST 4 — inter-state: Haryana → Karnataka, ₹1000 @ 18%')
{
  const r = determineGstSplit('06', '29', '1000.00', 18)
  assert("kind = 'inter'", 'inter', r.kind)
  assert('CGST = ₹0.00', '0.00', r.cgst.toFixed(2))
  assert('SGST = ₹0.00', '0.00', r.sgst.toFixed(2))
  assert('IGST = ₹180.00', '180.00', r.igst.toFixed(2))
}

// ── TEST 5: B2C — no buyer state, falls back to seller location ────
console.log('\nTEST 5 — B2C: seller=Haryana, buyer state unknown')
{
  const r = determineGstSplit('06', null, '1000.00', 18)
  assert("falls back to intra-state at seller location", 'intra', r.kind)
  assert('CGST = ₹90.00', '90.00', r.cgst.toFixed(2))
  assert('SGST = ₹90.00', '90.00', r.sgst.toFixed(2))
}

// ── TEST 6: odd-amount intra-state — paise exactness ────────────────
console.log('\nTEST 6 — ₹1234.56 @ 18% intra-state')
{
  const r = determineGstSplit('06', '06', '1234.56', 18)
  // 1234.56 × 0.18 = 222.2208 → totalTax = 222.22 (rounded to 2dp later)
  // half: 222.2208 / 2 = 111.1104 each side
  assert("CGST + SGST = 222.22 at paise", '222.22',
    roundCurrency(r.cgst.plus(r.sgst)).toFixed(2))
}

// ── TEST 7: amountInWords — from the brief's example ───────────────
console.log('\nTEST 7 — amountInWords')
{
  assert('₹3703.68 in words',
    'Indian Rupees Three Thousand Seven Hundred Three and Sixty Eight Paise Only',
    amountInWords('3703.68'))

  assert('₹1234.56 in words',
    'Indian Rupees One Thousand Two Hundred Thirty Four and Fifty Six Paise Only',
    amountInWords('1234.56'))

  assert('round amount: ₹10000 (no paise segment)',
    'Indian Rupees Ten Thousand Only',
    amountInWords('10000.00'))

  assert('zero',
    'Indian Rupees Zero Only',
    amountInWords('0'))

  assert('lakhs: ₹1,23,456.78',
    'Indian Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Eight Paise Only',
    amountInWords('123456.78'))

  assert('crore: ₹1,23,45,678.90',
    'Indian Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Ninety Paise Only',
    amountInWords('12345678.90'))

  assert('only paise: ₹0.99',
    'Indian Rupees Zero and Ninety Nine Paise Only',
    amountInWords('0.99'))
}

console.log(`\n─── ${passed} passed, ${failed} failed ───`)
process.exit(failed > 0 ? 1 : 0)
