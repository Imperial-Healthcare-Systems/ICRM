import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { supabaseAdmin } from './supabase'
import { verifyOtpChallenge } from './otp'

const MANAGER_ROLES = ['super_admin', 'admin', 'manager']

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'email-otp',
      credentials: {
        email: { type: 'email' },
        otp: { type: 'text' },
        challengeToken: { type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.otp || !credentials.challengeToken) {
          throw new Error('Missing credentials.')
        }

        const result = verifyOtpChallenge({
          email: credentials.email,
          otp: credentials.otp,
          challengeToken: credentials.challengeToken,
        })

        if (!result.valid) throw new Error(result.error ?? 'OTP verification failed.')

        const { data: user, error } = await supabaseAdmin
          .from('crm_users')
          .select(`
            id, email, full_name, avatar_url, role, org_id, is_active, crm_enabled,
            organisations!inner(subscription_status, plan_tier)
          `)
          .eq('email', credentials.email.trim().toLowerCase())
          .single()

        if (error || !user) throw new Error('No CRM account found for this email.')
        if (!user.is_active) throw new Error('Your account is inactive. Contact your administrator.')
        if (!user.crm_enabled) throw new Error('CRM access is not enabled for your account.')

        const org = Array.isArray(user.organisations) ? user.organisations[0] : user.organisations
        const subscriptionStatus = org?.subscription_status ?? 'trial'
        const planTier = org?.plan_tier ?? 'starter'

        if (subscriptionStatus === 'cancelled') {
          throw new Error('Your subscription has been cancelled. Please contact support.')
        }

        const isManager = MANAGER_ROLES.includes(user.role)

        return {
          id: user.id,
          email: user.email,
          name: user.full_name,
          image: user.avatar_url ?? null,
          role: user.role,
          orgId: user.org_id,
          planTier,
          subscriptionStatus,
          isAdmin: user.role === 'super_admin',
          isManager,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.orgId = user.orgId
        token.planTier = user.planTier
        token.subscriptionStatus = user.subscriptionStatus
        token.isAdmin = user.isAdmin
        token.isManager = user.isManager
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ''
        session.user.role = token.role as string
        session.user.orgId = token.orgId as string
        session.user.planTier = token.planTier as string
        session.user.subscriptionStatus = token.subscriptionStatus as string
        session.user.isAdmin = token.isAdmin as boolean
        session.user.isManager = token.isManager as boolean
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
}
