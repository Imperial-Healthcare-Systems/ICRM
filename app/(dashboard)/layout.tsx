import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { supabaseAdmin } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import ImperialBanner from '@/components/ImperialBanner'
import PoweredByImperial from '@/components/branding/PoweredByImperial'
import { getOrgBranding, brandingCssVars, effectiveAppName, showWatermark } from '@/lib/branding'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()

  if (!session?.user) {
    redirect('/login')
  }

  const [orgRes, branding] = await Promise.all([
    supabaseAdmin.from('organisations').select('name').eq('id', session.user.orgId).single(),
    getOrgBranding(session.user.orgId),
  ])

  const appName = effectiveAppName(branding, 'Imperial CRM')

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex flex-col" style={brandingCssVars(branding)}>
      <ImperialBanner />
      <div className="flex flex-1">
        <Sidebar
          userName={session.user.name ?? session.user.email}
          orgName={orgRes.data?.name ?? 'My Organisation'}
          planTier={session.user.planTier}
        />
        <main className="ml-60 flex-1 min-h-screen overflow-x-hidden">
          {children}
        </main>
      </div>
      {/* Server-resolved hide takes precedence over the client's session-based hint */}
      <PoweredByImperial hide={!showWatermark(branding)} context="footer" />
    </div>
  )
}
