import { NextRequest, NextResponse } from 'next/server'
import { sessionRepository, rewardRepository } from '@/lib/db'
import { logger } from '@/lib/observability/logger'

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }

  const auth =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.headers.get('x-cron-secret')
  if (auth !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const expiredSessions = await sessionRepository.expirePendingSessions(15)
    const expiredRewards = await rewardRepository.expireOldRewards()

    logger.info('Maintenance cron completed', { expiredSessions, expiredRewards })

    return NextResponse.json({
      success: true,
      expiredSessions,
      expiredRewards,
    })
  } catch (error) {
    logger.error('Maintenance cron failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ success: false, error: 'Maintenance failed' }, { status: 500 })
  }
}
