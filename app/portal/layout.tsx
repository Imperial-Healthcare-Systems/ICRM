import PoweredByImperial from '@/components/branding/PoweredByImperial'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-shell min-h-screen bg-[#0A1628] flex flex-col">
      <div className="flex-1">{children}</div>
      {/* Public-but-tokenized customer surface. No session → forceShow so
          the watermark always renders. If/when the portal page resolves
          the org and its branding server-side, swap to passing
          hide={!showWatermark(branding)} from a server-render step. */}
      <PoweredByImperial forceShow context="footer" />
    </div>
  )
}
