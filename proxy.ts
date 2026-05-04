import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

const ROLE_GATES: Record<string, string[]> = {
  '/admin': ['super_admin'],
  '/settings/billing': ['super_admin', 'admin'],
  '/settings/users': ['super_admin', 'admin'],
  '/settings/roles': ['super_admin'],
  '/reports': ['super_admin', 'admin', 'manager'],
  '/automation': ['super_admin', 'admin'],
}

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const { pathname } = req.nextUrl

  // Redirect unauthenticated users to login
  if (!token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const subscriptionStatus = token.subscriptionStatus as string

  // Block mutations for past_due orgs
  if (subscriptionStatus === 'past_due' && req.method !== 'GET') {
    return NextResponse.json({ error: 'Payment overdue. Please update your billing.' }, { status: 402 })
  }

  // Redirect cancelled/suspended orgs to billing
  if (['cancelled', 'suspended'].includes(subscriptionStatus) && !pathname.startsWith('/billing')) {
    return NextResponse.redirect(new URL('/billing', req.url))
  }

  // Role-based access control
  for (const [path, allowedRoles] of Object.entries(ROLE_GATES)) {
    if (pathname.startsWith(path)) {
      const role = token.role as string
      if (!allowedRoles.includes(role)) {
        return NextResponse.redirect(new URL('/dashboard?denied=1', req.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/leads/:path*',
    '/contacts/:path*',
    '/accounts/:path*',
    '/deals/:path*',
    '/activities/:path*',
    '/quotations/:path*',
    '/invoices/:path*',
    '/contracts/:path*',
    '/proposals/:path*',
    '/purchase-orders/:path*',
    '/vendors/:path*',
    '/support/:path*',
    '/field-visits/:path*',
    '/loyalty/:path*',
    '/campaigns/:path*',
    '/whatsapp/:path*',
    '/documents/:path*',
    '/reports/:path*',
    '/automation/:path*',
    '/intelligence/:path*',
    '/ecosystem/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/profile/:path*',
    '/billing/:path*',
    '/projects/:path*',
    '/tasks/:path*',
    '/timesheets/:path*',
    '/calendar/:path*',
    '/products/:path*',
    '/expenses/:path*',
    '/knowledge-base/:path*',
    '/announcements/:path*',
    '/subscriptions/:path*',
    '/email-sequences/:path*',
    '/territories/:path*',
    '/quotas/:path*',
    '/estimates/:path*',
    '/communications/:path*',
    '/api/subscriptions/:path*',
    '/api/email-sequences/:path*',
    '/api/projects/:path*',
    '/api/tasks/:path*',
    '/api/time-entries/:path*',
    '/api/calendar/:path*',
    '/api/products/:path*',
    '/api/expenses/:path*',
    '/api/kb/:path*',
    '/api/announcements/:path*',
    '/api/territories/:path*',
    '/api/quotas/:path*',
    '/api/communications/:path*',
  ],
}
