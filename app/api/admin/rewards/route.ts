import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { rewardRepository, userRepository } from '@/lib/db'
import { mapRewardFromDb } from '@/lib/mappers/domain-mappers'

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const params = request.nextUrl.searchParams
  const email = params.get('email')
  let rewards = await rewardRepository.getAll({
    status: params.get('status')?.split(',').filter(Boolean),
    search: params.get('search') || undefined,
    limit: params.get('limit') ? Number(params.get('limit')) : 200,
  })

  if (email) {
    const user = await userRepository.getByEmail(email)
    if (user) rewards = rewards.filter((r) => r.user_id === user.id)
    else rewards = []
  }

  return NextResponse.json({ success: true, data: rewards.map((r) => mapRewardFromDb(r)) })
}
