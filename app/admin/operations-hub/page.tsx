'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { AdminErrorBanner, AdminEmptyState } from '@/components/admin/admin-states'
import { AdminPageSkeleton } from '@/components/admin/admin-skeletons'
import {
  ExternalLink,
  RefreshCw,
  Shield,
  AlertCircle,
} from 'lucide-react'

type HubLink = {
  id: string
  label: string
  description: string
  resolvedUrl: string | null
  hasUrl: boolean
  environment?: string
  adminOnly?: boolean
  external?: boolean
  informational?: boolean
}

type HubSection = {
  id: string
  title: string
  description: string
  links: HubLink[]
}

type HubResponse = {
  environment: string
  appOrigin: string
  sections: HubSection[]
}

export default function OperationsHubPage() {
  const [data, setData] = useState<HubResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/operations-hub', { credentials: 'include' })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error || 'Failed to load Operations Hub')
        return
      }
      setData(body.data)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) return <AdminPageSkeleton />

  const linkable = (l: HubLink) => !l.informational
  const configuredCount =
    data?.sections.reduce(
      (n, s) => n + s.links.filter((l) => linkable(l) && (l.hasUrl || l.informational)).length,
      0,
    ) ?? 0
  const totalLinks =
    data?.sections.reduce((n, s) => n + s.links.filter(linkable).length, 0) ?? 0

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Operations Hub"
        description="Third-party services, provider dashboards, and operational resources for running Powerdon"
        meta={
          data ? (
            <p className="text-xs text-muted-foreground">
              Environment: <Badge variant="secondary">{data.environment}</Badge>
              {' · '}
              {configuredCount}/{totalLinks} links configured
            </p>
          ) : null
        }
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={load} />}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex gap-3 p-4 text-sm">
          <Shield className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            Manage hardware units on the{' '}
            <a href="/admin/stations" className="font-medium text-foreground underline">
              Hardware
            </a>{' '}
            page. Staff and station operations stay in this dashboard — not external consoles.
          </p>
        </CardContent>
      </Card>

      {!data ? null : (
        <div className="space-y-6">
          {data.sections.map((section) => {
            const hasConfigured = section.links.some((l) => l.hasUrl || l.informational)
            return (
              <Card key={section.id}>
                <CardHeader>
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {!hasConfigured && section.links.every((l) => !l.hasUrl && !l.informational) ? (
                    <AdminEmptyState
                      title="No links configured"
                      description={`Set OPS_* environment variables for ${section.title.toLowerCase()} to enable links.`}
                    />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {section.links.map((link) => (
                        <div
                          key={link.id}
                          className="flex flex-col justify-between rounded-lg border border-border p-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{link.label}</p>
                              {link.adminOnly && (
                                <Badge variant="outline" className="text-[10px]">
                                  Admin
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{link.description}</p>
                          </div>
                          <div className="mt-3">
                            {link.informational ? (
                              <Badge variant="secondary" className="text-[10px]">
                                Reference
                              </Badge>
                            ) : link.hasUrl && link.resolvedUrl ? (
                              <Button variant="outline" size="sm" asChild>
                                <a
                                  href={link.resolvedUrl}
                                  target={link.external !== false ? '_blank' : undefined}
                                  rel={link.external !== false ? 'noopener noreferrer' : undefined}
                                >
                                  <ExternalLink className="mr-2 size-3.5" />
                                  {link.external === false ? 'Open in app' : 'Open'}
                                </a>
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <AlertCircle className="size-3.5" />
                                Not configured
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

    </div>
  )
}
