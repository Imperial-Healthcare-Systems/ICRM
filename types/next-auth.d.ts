import 'next-auth'
import 'next-auth/jwt'

type ImpersonatedBy = {
  identityId: string
  email: string
  name: string
  startedAt: string
} | null

declare module 'next-auth' {
  interface User {
    role: string
    orgId: string
    planTier: string
    subscriptionStatus: string
    isAdmin: boolean
    isManager: boolean
    identityId?: string | null
    membershipId?: string | null
    membershipRole?: string | null
    impersonatedBy?: ImpersonatedBy
  }

  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: string
      orgId: string
      planTier: string
      subscriptionStatus: string
      isAdmin: boolean
      isManager: boolean
      identityId?: string | null
      membershipId?: string | null
      membershipRole?: string | null
      impersonatedBy?: ImpersonatedBy
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    orgId: string
    planTier: string
    subscriptionStatus: string
    isAdmin: boolean
    isManager: boolean
    identityId?: string | null
    membershipId?: string | null
    membershipRole?: string | null
    impersonatedBy?: ImpersonatedBy
  }
}
