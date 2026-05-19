import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const callbackUrl = url.searchParams.get('callbackUrl') ?? '/dashboard'

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', req.url))
  }

  const signInUrl = new URL('/api/auth/signin/imperial-impersonation', req.url)
  const csrfRes = await fetch(new URL('/api/auth/csrf', req.url), {
    headers: { cookie: req.headers.get('cookie') ?? '' },
  })
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }
  const setCookie = csrfRes.headers.get('set-cookie') ?? ''

  const form = new URLSearchParams()
  form.set('csrfToken', csrfToken)
  form.set('imperialToken', token)
  form.set('callbackUrl', callbackUrl)
  form.set('json', 'true')

  const signInRes = await fetch(signInUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      cookie: setCookie,
    },
    body: form.toString(),
    redirect: 'manual',
  })

  const sessionCookie = signInRes.headers.get('set-cookie') ?? ''
  const redirect = NextResponse.redirect(new URL(callbackUrl, req.url))

  for (const c of sessionCookie.split(/,(?=\s*[A-Za-z0-9_-]+=)/)) {
    if (c.trim()) redirect.headers.append('set-cookie', c.trim())
  }

  return redirect
}
