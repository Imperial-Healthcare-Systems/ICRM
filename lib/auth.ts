import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { supabaseAdmin } from './supabase'
import { verifyOtpChallenge } from './otp'
import { verifyImperialToken } from './imperial-impersonation'

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
            identity_id, membership_id,
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

        let membershipRole: string | null = null
        if (user.membership_id) {
          const { data: mem } = await supabaseAdmin
            .from('memberships')
            .select('role')
            .eq('id', user.membership_id)
            .maybeSingle()
          membershipRole = (mem?.role as string | undefined) ?? null
        }

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
          identityId: user.identity_id ?? null,
          membershipId: user.membership_id ?? null,
          membershipRole,
        }
      },
    }),
    CredentialsProvider({
      id: 'imperial-impersonation',
      name: 'imperial-impersonation',
      credentials: {
        imperialToken: { type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.imperialToken) throw new Error('Missing impersonation token.')

        const result = verifyImperialToken(credentials.imperialToken)
        if (!result.valid) throw new Error(result.error)

        const { identityId, orgId, impersonatedByIdentityId, impersonatedByEmail, impersonatedByName } = result.claims

        const { data: user, error } = await supabaseAdmin
          .from('crm_users')
          .select(`
            id, email, full_name, avatar_url, role, org_id, is_active, crm_enabled,
            identity_id, membership_id,
            organisations!inner(subscription_status, plan_tier)
          `)
          .eq('identity_id', identityId)
          .eq('org_id', orgId)
          .single()

        if (error || !user) throw new Error('Target user not found in this org.')
        if (!user.is_active) throw new Error('Target user is inactive.')

        const org = Array.isArray(user.organisations) ? user.organisations[0] : user.organisations
        const subscriptionStatus = org?.subscription_status ?? 'trial'
        const planTier = org?.plan_tier ?? 'starter'

        let membershipRole: string | null = null
        if (user.membership_id) {
          const { data: mem } = await supabaseAdmin
            .from('memberships')
            .select('role')
            .eq('id', user.membership_id)
            .maybeSingle()
          membershipRole = (mem?.role as string | undefined) ?? null
        }

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
          isManager: MANAGER_ROLES.includes(user.role),
          identityId: user.identity_id ?? null,
          membershipId: user.membership_id ?? null,
          membershipRole,
          impersonatedBy: {
            identityId: impersonatedByIdentityId,
            email: impersonatedByEmail,
            name: impersonatedByName,
            startedAt: new Date().toISOString(),
          },
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger, session: updatePayload }) {
      if (user) {
        token.role = user.role
        token.orgId = user.orgId
        token.planTier = user.planTier
        token.subscriptionStatus = user.subscriptionStatus
        token.isAdmin = user.isAdmin
        token.isManager = user.isManager
        token.identityId = user.identityId ?? null
        token.membershipId = user.membershipId ?? null
        token.membershipRole = user.membershipRole ?? null
        token.impersonatedBy = user.impersonatedBy ?? null
      }

      if (trigger === 'update' && token.identityId && (updatePayload as { activeOrgId?: string })?.activeOrgId) {
        const targetOrgId = (updatePayload as { activeOrgId: string }).activeOrgId

        const { data: mem } = await supabaseAdmin
          .from('memberships')
          .select('id, role')
          .eq('identity_id', token.identityId)
          .eq('org_id', targetOrgId)
          .eq('status', 'active')
          .maybeSingle()

        if (mem) {
          const { data: crmUser } = await supabaseAdmin
            .from('crm_users')
            .select(`
              id, role,
              organisations!inner(plan_tier, subscription_status)
            `)
            .eq('identity_id', token.identityId)
            .eq('org_id', targetOrgId)
            .maybeSingle()

          if (crmUser) {
            const org = Array.isArray(crmUser.organisations) ? crmUser.organisations[0] : crmUser.organisations
            token.sub = crmUser.id
            token.orgId = targetOrgId
            token.role = crmUser.role
            token.planTier = (org as { plan_tier: string })?.plan_tier ?? 'starter'
            token.subscriptionStatus = (org as { subscription_status: string })?.subscription_status ?? 'trial'
            token.isAdmin = crmUser.role === 'super_admin'
            token.isManager = MANAGER_ROLES.includes(crmUser.role)
            token.membershipId = mem.id
            token.membershipRole = mem.role
          }
        }
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
        session.user.identityId = (token.identityId as string | null) ?? null
        session.user.membershipId = (token.membershipId as string | null) ?? null
        session.user.membershipRole = (token.membershipRole as string | null) ?? null
        session.user.impersonatedBy = token.impersonatedBy ?? null
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
