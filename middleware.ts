import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - API routes that don't need auth (public endpoints)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
