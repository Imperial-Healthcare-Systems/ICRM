'use client'

import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider, useTheme } from '@/components/ThemeProvider'

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: isDark ? '#0D1B2E' : '#FFFFFF',
          color: isDark ? '#FFFFFF' : '#0A0E1A',
          border: isDark
            ? '1px solid rgba(255,255,255,0.10)'
            : '1px solid rgba(15,23,42,0.10)',
          boxShadow: isDark
            ? '0 18px 36px -12px rgba(0,0,0,0.55)'
            : '0 12px 32px -8px rgba(15,23,42,0.18), 0 4px 12px -4px rgba(15,23,42,0.08)',
          fontSize: '13px',
          borderRadius: '12px',
        },
      }}
    />
  )
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <ThemedToaster />
      </ThemeProvider>
    </SessionProvider>
  )
}
