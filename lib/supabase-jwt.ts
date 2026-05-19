import { SignJWT } from 'jose'

const TOKEN_TTL_SECONDS = 60

export type SupabaseTokenClaims = {
  identityId: string
  activeOrgId: string | null
  isPlatformAdmin: boolean
  membershipId?: string | null
  membershipRole?: string | null
  impersonatedByIdentityId?: string | null
  role?: 'authenticated' | 'anon' | 'service_role'
}

// Supabase JWT secrets come in two shapes:
//  - Plain UTF-8 string (legacy projects, "super-secret-jwt-token-..." style)
//  - Base64-encoded 256-bit key (newer projects, 44 chars ending in '=')
// PostgREST is configured with jwt-secret-is-base64 to match. Detect from format.
function getJwtSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is not set — tenant-scoped Supabase requests cannot be signed.')
  }
  if (looksBase64(secret)) {
    return Buffer.from(secret, 'base64')
  }
  return new TextEncoder().encode(secret)
}

function looksBase64(s: string): boolean {
  // Base64 alphabet with optional padding; length divisible by 4
  if (s.length % 4 !== 0) return false
  if (!/^[A-Za-z0-9+/]+=*$/.test(s)) return false
  // Disambiguate from plain strings that happen to be base64-clean:
  // require either a '+' or '/' (uncommon in legacy plain secrets) or trailing '='
  return /[+/=]/.test(s)
}

export async function signSupabaseToken(claims: SupabaseTokenClaims): Promise<string> {
  const payload = {
    sub: claims.identityId,
    role: claims.role ?? 'authenticated',
    identity_id: claims.identityId,
    active_org_id: claims.activeOrgId,
    is_platform_admin: claims.isPlatformAdmin,
    membership_id: claims.membershipId ?? null,
    membership_role: claims.membershipRole ?? null,
    impersonated_by_identity_id: claims.impersonatedByIdentityId ?? null,
  }

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret())
}
