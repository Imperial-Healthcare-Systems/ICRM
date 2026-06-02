/**
 * Money math + display helpers for the Finance module.
 *
 * Uses `decimal.js` (not native `number`) for all arithmetic so that
 * 0.1 + 0.2 is exactly 0.30 and accumulated line-item sums don't drift.
 *
 * Storage contract:
 *   - All money columns are NUMERIC(15,2) in Postgres.
 *   - From JS, write money as a string with exactly 2 decimals
 *     (use `toCurrencyString`). Postgres accepts the string and stores
 *     it lossless. Writing a JS number works too but is float-fragile
 *     for very large amounts (>= 2^53 paise).
 *
 * Compute contract:
 *   - `toDecimal()` is the only entry point for "I have a value from
 *     the DB / user input / JSON; convert it to a precise Decimal".
 *   - Do all line-item math at FULL precision (no rounding).
 *   - Round ONCE, at the end, when storing the final figure or
 *     producing the displayed amount.
 *   - Default rounding mode: ROUND_HALF_UP (INR / GST convention).
 */
import Decimal from 'decimal.js'

// Configure decimal.js once for the whole app.
//   - precision 30 is overkill for INR but cheap and prevents loss
//   - rounding default ROUND_HALF_UP matches CBIC GST convention
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP })

export type MoneyInput = Decimal | number | string | null | undefined

/**
 * Convert any input to a Decimal. Null/undefined/empty/'NaN' → Decimal(0).
 * Strings are preferred over numbers for round-trip safety.
 */
export function toDecimal(input: MoneyInput): Decimal {
  if (input === null || input === undefined || input === '') return new Decimal(0)
  if (input instanceof Decimal) return input
  try {
    const d = new Decimal(input as Decimal.Value)
    if (d.isNaN()) return new Decimal(0)
    return d
  } catch {
    return new Decimal(0)
  }
}

/**
 * Precise sum. Use this instead of `arr.reduce((s, x) => s + Number(x), 0)`
 * for any array of money values.
 */
export function sumDecimals(values: Iterable<MoneyInput>): Decimal {
  let acc = new Decimal(0)
  for (const v of values) acc = acc.plus(toDecimal(v))
  return acc
}

/**
 * Multiply two values precisely (e.g. qty × unit_price).
 */
export function multiply(a: MoneyInput, b: MoneyInput): Decimal {
  return toDecimal(a).times(toDecimal(b))
}

/**
 * Compute base + GST in one step at full precision.
 *
 * Returns the trio at FULL precision (no rounding). Callers decide
 * whether to round before storing — typically yes for `tax` and
 * `total`, no for intermediate aggregations.
 */
export function applyTax(base: MoneyInput, ratePct: MoneyInput): {
  base: Decimal
  tax: Decimal
  total: Decimal
} {
  const b = toDecimal(base)
  const r = toDecimal(ratePct).dividedBy(100)
  const tax = b.times(r)
  return { base: b, tax, total: b.plus(tax) }
}

/**
 * Round a Decimal to exactly 2 decimal places using ROUND_HALF_UP.
 * Use for the final figure that gets stored or displayed.
 */
export function roundCurrency(d: MoneyInput): Decimal {
  return toDecimal(d).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
}

/**
 * Render a Decimal as a 2-decimal string suitable for inserting into a
 * NUMERIC column (e.g. '3703.68'). Postgres parses this losslessly.
 *
 * Prefer this over passing a JS `number` to .insert(...) — string values
 * survive PostgREST's JSON serialisation without IEEE-754 quirks.
 */
export function toCurrencyString(d: MoneyInput): string {
  return roundCurrency(d).toFixed(2)
}

/**
 * Render a Decimal as a JS number — ONLY for response payloads or when
 * the caller explicitly needs a number. Safe for typical INR amounts
 * (< 2^53 paise ≈ ₹90 trillion). DO NOT use this in the middle of an
 * arithmetic chain.
 */
export function toCurrencyNumber(d: MoneyInput): number {
  return roundCurrency(d).toNumber()
}

/**
 * Compare two money values for equality to the paise. Replaces the
 * brittle `Math.abs(a - b) < 0.01` pattern.
 */
export function equalsToPaise(a: MoneyInput, b: MoneyInput): boolean {
  return roundCurrency(a).equals(roundCurrency(b))
}

/**
 * Greater-than comparison at paise precision. `a > b` rounded to 2dp.
 */
export function greaterThanToPaise(a: MoneyInput, b: MoneyInput): boolean {
  return roundCurrency(a).greaterThan(roundCurrency(b))
}

/**
 * Greater-than-or-equal at paise precision.
 */
export function gteToPaise(a: MoneyInput, b: MoneyInput): boolean {
  return roundCurrency(a).greaterThanOrEqualTo(roundCurrency(b))
}

/**
 * Maximum of (0, a - b). Useful for "outstanding balance" calculations
 * where overpayment shouldn't show as negative.
 */
export function clampedDifference(a: MoneyInput, b: MoneyInput): Decimal {
  const diff = toDecimal(a).minus(toDecimal(b))
  return diff.isNegative() ? new Decimal(0) : diff
}

// ─── Display ──────────────────────────────────────────────────────────

/**
 * Format a value as INR with paise: "₹1,234.56" (or e.g. "$1,234.56" if a
 * different currency is passed). Always 2 decimals.
 *
 * Replaces every inline `Intl.NumberFormat('en-IN', { ..., maximumFractionDigits: 0 })`
 * across the Finance module. The display is the LAST step — never feed
 * the formatter's output back into math.
 */
export function formatINR(value: MoneyInput, currency: string = 'INR'): string {
  const n = toCurrencyNumber(value)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/**
 * Format without the currency symbol — useful for table cells where the
 * currency is shown in a header. "1,234.56".
 */
export function formatINRPlain(value: MoneyInput): string {
  const n = toCurrencyNumber(value)
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

// ═════════════════════════════════════════════════════════════════════
// Indian GST helpers — state codes, CGST/SGST/IGST split, GSTIN check,
// amount in words.
// ═════════════════════════════════════════════════════════════════════

/**
 * Canonical GST state-code map. Codes 01-38 cover all states + UTs as
 * issued by CBIC. First two digits of a GSTIN match the state code of
 * the place of registration.
 *
 * Keep this in lock-step with crm_accounts.billing_state_code (the
 * Postgres CHECK constraint allows any 2-digit string; the app's UI
 * dropdown enforces the valid list).
 */
export const GST_STATE_CODES: Readonly<Record<string, string>> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
}

/** Reverse lookup: state name → code. Lowercase-insensitive. */
export const GST_STATE_NAME_TO_CODE: Readonly<Record<string, string>> =
  Object.freeze(
    Object.fromEntries(
      Object.entries(GST_STATE_CODES).map(([code, name]) => [name.toLowerCase(), code]),
    ),
  )

/** GSTIN regex — keep in lock-step with the Postgres CHECK constraint. */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

/** Returns true iff the input is a syntactically valid GSTIN. */
export function isValidGstin(gstin: string | null | undefined): boolean {
  if (!gstin) return false
  return GSTIN_REGEX.test(gstin)
}

/** First two characters of a GSTIN are the GST state code. */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!isValidGstin(gstin)) return null
  return gstin!.slice(0, 2)
}

/**
 * Decide CGST+SGST (intra-state) vs IGST (inter-state) based on the
 * seller's and buyer's state codes, and compute the amounts.
 *
 * Indian GST rules:
 *   - Same state → split the total GST equally into CGST and SGST.
 *     CGST goes to the central govt, SGST to the state govt.
 *   - Different states → single IGST at the full rate. The destination
 *     state gets its share via the central settlement mechanism.
 *   - B2C buyer with no state captured → defaults to intra-state at the
 *     seller's location (place of supply = seller state).
 *
 * `taxPct` is the total GST rate (e.g. 18 for 18%). For intra-state the
 * cgst+sgst rates each become taxPct/2 (e.g. 9 + 9).
 */
export function determineGstSplit(
  sellerStateCode: string | null | undefined,
  buyerStateCode: string | null | undefined,
  taxableBase: MoneyInput,
  taxPct: MoneyInput,
): {
  kind: 'intra' | 'inter'
  cgst: Decimal
  sgst: Decimal
  igst: Decimal
  totalTax: Decimal
} {
  const base = toDecimal(taxableBase)
  const rate = toDecimal(taxPct).dividedBy(100)
  const totalTax = base.times(rate)

  // No buyer state → treat as intra-state at seller location (place of
  // supply defaults to the seller's state).
  const effectiveBuyer = buyerStateCode ?? sellerStateCode ?? null

  if (sellerStateCode && effectiveBuyer && sellerStateCode === effectiveBuyer) {
    const half = totalTax.dividedBy(2)
    return {
      kind: 'intra',
      cgst: half,
      sgst: half,
      igst: new Decimal(0),
      totalTax,
    }
  }

  // Inter-state OR insufficient state info → IGST.
  return {
    kind: 'inter',
    cgst: new Decimal(0),
    sgst: new Decimal(0),
    igst: totalTax,
    totalTax,
  }
}

/**
 * Format a "Place of Supply" line: "Haryana (06)".
 * Returns "—" if neither name nor code resolves cleanly.
 */
export function formatPlaceOfSupply(stateCode: string | null | undefined): string {
  if (!stateCode || !/^[0-9]{2}$/.test(stateCode)) return '—'
  const name = GST_STATE_CODES[stateCode]
  return name ? `${name} (${stateCode})` : `(${stateCode})`
}

// ─── Amount in words (Indian numbering — lakhs, crores) ──────────────

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigitsToWords(n: number): string {
  if (n === 0) return ''
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return TENS[t] + (o ? ' ' + ONES[o] : '')
}

function threeDigitsToWords(n: number): string {
  if (n === 0) return ''
  const h = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (h > 0) parts.push(ONES[h] + ' Hundred')
  if (rest > 0) parts.push(twoDigitsToWords(rest))
  return parts.join(' ')
}

/**
 * Convert an integer to Indian-numbering words ("One Lakh Twenty Three Thousand").
 * Accepts integers up to 99 crores (sufficient for any plausible invoice).
 */
function integerToIndianWords(n: number): string {
  if (n === 0) return 'Zero'
  if (n < 0) return 'Negative ' + integerToIndianWords(-n)

  const parts: string[] = []

  const crores = Math.floor(n / 10000000)
  if (crores > 0) {
    parts.push(integerToIndianWords(crores) + ' Crore')
    n %= 10000000
  }

  const lakhs = Math.floor(n / 100000)
  if (lakhs > 0) {
    parts.push(twoDigitsToWords(lakhs) + ' Lakh')
    n %= 100000
  }

  const thousands = Math.floor(n / 1000)
  if (thousands > 0) {
    parts.push(twoDigitsToWords(thousands) + ' Thousand')
    n %= 1000
  }

  if (n > 0) parts.push(threeDigitsToWords(n))

  return parts.join(' ').trim()
}

/**
 * Format a money amount as words for an Indian invoice.
 *
 * Output shape (matches the brief):
 *   "Indian Rupees Three Thousand Seven Hundred Three and Sixty-Eight Paise Only"
 *
 * For round amounts (zero paise), the "and ... Paise" segment is omitted:
 *   "Indian Rupees Three Thousand Seven Hundred Three Only"
 */
export function amountInWords(value: MoneyInput, currency: string = 'INR'): string {
  const rounded = roundCurrency(value)
  const isNegative = rounded.isNegative()
  const absVal = rounded.abs()

  const rupeesInt = absVal.floor().toNumber()
  const paiseInt = absVal.minus(absVal.floor()).times(100).round().toNumber()

  const currencyName = currency === 'INR' ? 'Indian Rupees' : currency
  const rupeesWords = integerToIndianWords(rupeesInt)

  let out = `${currencyName} ${rupeesWords}`
  if (paiseInt > 0) {
    out += ` and ${twoDigitsToWords(paiseInt)} Paise`
  }
  out += ' Only'

  return isNegative ? 'Negative ' + out : out
}
