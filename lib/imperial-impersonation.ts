import crypto from 'node:crypto'

const TOKEN_TTL_MINUTES = 5

export type ImperialImpersonationClaims = {
  identityId: string
  orgId: string
  impersonatedByIdentityId: string
  impersonatedByEmail: string
  impersonatedByName: string
}

type Payload = ImperialImpersonationClaims & { v: 1; exp: number }

function getSecret() {
  const s = process.env.IMPERIAL_IMPERSONATION_SECRET
  if (!s) throw new Error('IMPERIAL_IMPERSONATION_SECRET is not set.')
  return s
}

function sign(value: string) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url')
}

function safeCompare(a: string, b: string) {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export function createImperialToken(claims: ImperialImpersonationClaims): string {
  const payload: Payload = {
    v: 1,
    ...claims,
    exp: Date.now() + TOKEN_TTL_MINUTES * 60 * 1000,
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

export function verifyImperialToken(
  token: string,
): { valid: true; claims: ImperialImpersonationClaims } | { valid: false; error: string } {
  try {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return { valid: false, error: 'Malformed token.' }

    const expected = sign(encoded)
    if (!safeCompare(signature, expected)) return { valid: false, error: 'Invalid signature.' }

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Payload
    if (payload.v !== 1) return { valid: false, error: 'Unsupported token version.' }
    if (payload.exp < Date.now()) return { valid: false, error: 'Token expired.' }

    return {
      valid: true,
      claims: {
        identityId: payload.identityId,
        orgId: payload.orgId,
        impersonatedByIdentityId: payload.impersonatedByIdentityId,
        impersonatedByEmail: payload.impersonatedByEmail,
        impersonatedByName: payload.impersonatedByName,
      },
    }
  } catch {
    return { valid: false, error: 'Could not parse token.' }
  }
}
