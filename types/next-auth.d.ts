import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface User {
    role: string
    orgId: string
    planTier: string
    subscriptionStatus: string
    isAdmin: boolean
    isManager: boolean
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
  }
}
