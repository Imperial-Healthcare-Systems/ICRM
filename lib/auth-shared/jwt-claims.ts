/**
 * JWT claim builders for the impersonation flow — Phase 5 of
 * IMPERIAL_TENANT_SPEC v1.0 §3 + §8.1.
 *
 * Admin Console issues tokens via signImpersonationToken() and customer
 * apps (ICRM here, plus IHRMS) verify them via verifyImpersonationToken().
 *
 * Canonical contract — keep this file in lock-step across all three apps
 * (admin-panel/lib/auth-shared/jwt-claims.ts,
 *  IHRMS-2/lib/auth-shared/jwt-claims.ts,
 *  ICRM/icrm-app/lib/auth-shared/jwt-claims.ts).
 *
 * Note: this is a different file from the legacy `lib/imperial-impersonation.ts`
 * which uses a custom HMAC-SHA256 + base64url format. That older helper is
 * retained for any callers still using it. New code should import from
 * `@/lib/auth-shared/jwt-claims` and use the JWT format that Admin Console
 * actually issues.
 */
import { SignJWT, jwtVerify } from 'jose'

export interface ImpersonationClaims {
  /** identity_id (or, for legacy callers, crm_users.id) */
  sub: string
  /** target organisation */
  orgId: string
  /** Imperial admin's identity_id (or legacy employee.id) */
  impersonator: string
  /** platform_impersonation_log row id — receiver verifies this is still open */
  logId: string
  /** human-readable reason */
  reason?: string
  /** marker so we never confuse impersonation tokens with normal session tokens */
  isImpersonation: true
}

const ALG = 'HS256'

function getSecret(): Uint8Array {
  const secret = process.env.IMPERSONATION_SECRET
  if (!secret) {
    throw new Error('IMPERSONATION_SECRET not configured')
  }
  return new TextEncoder().encode(secret)
}

/**
 * Issue a short-lived impersonation token (1 hour by default).
 * Called by Admin Console only.
 */
export async function signImpersonationToken(
  claims: ImpersonationClaims,
  expiresIn: string = '1h',
): Promise<string> {
  return await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret())
}

/**
 * Verify and decode an impersonation token. Throws on invalid/expired.
 * Called by IHRMS / ICRM impersonation-login receivers.
 */
export async function verifyImpersonationToken(token: string): Promise<ImpersonationClaims> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALG] })
  if (!(payload as { isImpersonation?: boolean }).isImpersonation) {
    throw new Error('Token is not an impersonation token')
  }
  return payload as unknown as ImpersonationClaims
}
