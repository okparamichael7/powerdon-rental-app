import { NextRequest, NextResponse } from 'next/server'
import { requireHardwarePermission } from '@/lib/api/route-helpers'
import {
  getOperationsHubLinks,
  resolveOperationsHubUrl,
} from '@/lib/admin/operations-hub-config'

function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

export async function GET(request: NextRequest) {
  const auth = await requireHardwarePermission(request, 'operations_hub.read')
  if (!auth.ok) return auth.response

  const origin = appOrigin()
  const environment =
    process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development'

  const sections = getOperationsHubLinks({
    isAdmin: auth.auth.isAdmin,
    environment,
  }).map((section) => ({
    ...section,
    links: section.links.map((link) => ({
      ...link,
      resolvedUrl: resolveOperationsHubUrl(link, origin),
      hasUrl: Boolean(resolveOperationsHubUrl(link, origin)),
    })),
  }))

  return NextResponse.json({
    success: true,
    data: {
      environment,
      appOrigin: origin,
      sections,
    },
  })
}
