export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-shell min-h-screen bg-[#0A1628]">
      {children}
    </div>
  )
}
