import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/api/route-helpers'

/** Rate-limit gate for admin password login (client calls before signInWithPassword). */
export async function POST(request: NextRequest) {
  const rateLimited = await enforceRateLimit(request, 'auth')
  if (rateLimited) return rateLimited
  return NextResponse.json({ ok: true })
}
