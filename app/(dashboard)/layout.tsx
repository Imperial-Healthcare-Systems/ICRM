import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect('/login')
  }

  const { data: org } = await supabaseAdmin
    .from('organisations')
    .select('name')
    .eq('id', session.user.orgId)
    .single()

  return (
    <div className="min-h-screen bg-[#0A1628] flex">
      <Sidebar
        userName={session.user.name ?? session.user.email}
        orgName={org?.name ?? 'My Organisation'}
        planTier={session.user.planTier}
      />
      <main className="ml-60 flex-1 min-h-screen overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
