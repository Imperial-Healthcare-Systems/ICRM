export default function ImperialWatermark({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div className="fixed bottom-3 right-3 z-30 text-[10px] text-slate-500 pointer-events-none select-none opacity-70">
      Powered by Imperial CRM
    </div>
  )
}
