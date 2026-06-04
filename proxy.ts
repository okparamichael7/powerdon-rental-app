import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ADMIN_PUBLIC_PATHS = ['/admin/login', '/admin/auth']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith('/admin')) {
    const isPublic = ADMIN_PUBLIC_PATHS.some((p) => pathname.startsWith(p))
    if (!isPublic && !user) {
      const login = new URL('/admin/login', request.url)
      login.searchParams.set('redirect', pathname)
      return NextResponse.redirect(login)
    }
    if (!isPublic && user) {
      const isAdmin =
        user.user_metadata?.is_admin === true ||
        user.user_metadata?.role === 'admin' ||
        user.user_metadata?.role === 'operator'
      if (!isAdmin) {
        return NextResponse.redirect(new URL('/admin/login?error=forbidden', request.url))
      }
    }
  }

  if (pathname.startsWith('/api/admin') && !user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  if (pathname.startsWith('/api/admin') && user) {
    const isAdmin =
      user.user_metadata?.is_admin === true ||
      user.user_metadata?.role === 'admin' ||
      user.user_metadata?.role === 'operator'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
