export type OperationsHubLinkCategory =
  | 'qr_tools'
  | 'payment'
  | 'notifications'
  | 'maps'
  | 'analytics'
  | 'documentation'

export interface OperationsHubLink {
  id: string
  category: OperationsHubLinkCategory
  label: string
  description: string
  url: string | null
  environment?: string
  lastVerified?: string
  adminOnly?: boolean
  external?: boolean
  /** Inline reference — no external URL required */
  informational?: boolean
}

export interface OperationsHubSection {
  id: OperationsHubLinkCategory
  title: string
  description: string
  links: OperationsHubLink[]
}

const CATEGORY_META: Record<
  OperationsHubLinkCategory,
  { title: string; description: string }
> = {
  qr_tools: {
    title: 'QR Code Tools',
    description: 'Generate and manage QR codes that link customers to hardware units.',
  },
  payment: {
    title: 'Payment Provider',
    description: 'Stripe dashboards and payment operations.',
  },
  notifications: {
    title: 'Email / SMS / Notifications',
    description: 'Messaging provider dashboards and templates.',
  },
  maps: {
    title: 'Maps / Location / Delivery',
    description: 'Routing, delivery, and location tools.',
  },
  analytics: {
    title: 'Analytics & Monitoring',
    description: 'Dashboards, error tracking, and uptime monitoring.',
  },
  documentation: {
    title: 'Documentation & Runbooks',
    description: 'SOPs, setup guides, and incident response.',
  },
}

function envLink(
  envVar: string,
  fallback: string | null = null,
): string | null {
  const value = process.env[envVar]?.trim()
  if (value) return value
  return fallback
}

/** First non-empty env var wins (supports renames without breaking deploys). */
function envLinkFirst(envVars: string[]): string | null {
  for (const key of envVars) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return null
}

function buildAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim()?.replace(/^/, 'https://') ||
    'http://localhost:3000'
  )
}

export function getOperationsHubLinks(options?: {
  isAdmin?: boolean
  environment?: string
}): OperationsHubSection[] {
  const isAdmin = options?.isAdmin ?? false
  const environment =
    options?.environment ??
    process.env.NEXT_PUBLIC_APP_ENV ??
    process.env.NODE_ENV ??
    'development'
  const appOrigin = buildAppOrigin()

  const rawLinks: OperationsHubLink[] = [
    {
      id: 'qr-generator',
      category: 'qr_tools',
      label: 'QR Code Generator',
      description:
        'Create QR images from station URLs. Set OPS_QR_GENERATOR_URL (e.g. qr-code-generator.com).',
      url: envLink('OPS_QR_GENERATOR_URL'),
      environment,
    },
    {
      id: 'qr-management',
      category: 'qr_tools',
      label: 'QR Management Dashboard',
      description:
        'Track printed QR batches and station assignments. Set OPS_QR_MANAGEMENT_URL (separate from the generator).',
      url: envLinkFirst(['OPS_QR_MANAGEMENT_URL', 'OPS_QR_DASHBOARD_URL']),
      environment,
    },
    {
      id: 'qr-notes',
      category: 'qr_tools',
      label: 'QR Usage Notes',
      description: `Customer PWA reads ?station= or ?stationId= query params. Example: ${appOrigin}/?station={station-uuid}`,
      url: null,
      environment,
      informational: true,
    },
    {
      id: 'stripe-dashboard',
      category: 'payment',
      label: 'Stripe Dashboard',
      description: 'Payments, refunds, and dispute management.',
      url: envLink('OPS_STRIPE_DASHBOARD_URL', 'https://dashboard.stripe.com'),
      environment,
    },
    {
      id: 'stripe-refunds',
      category: 'payment',
      label: 'Stripe Refunds',
      description: 'Process refunds for rental billing issues.',
      url: envLink('OPS_STRIPE_REFUNDS_URL', 'https://dashboard.stripe.com/refunds'),
      environment,
    },
    {
      id: 'email-provider',
      category: 'notifications',
      label: 'Email Provider',
      description: 'Transactional email dashboard.',
      url: envLink('OPS_EMAIL_DASHBOARD_URL'),
      environment,
    },
    {
      id: 'sms-provider',
      category: 'notifications',
      label: 'SMS Provider',
      description: 'SMS notifications dashboard.',
      url: envLink('OPS_SMS_DASHBOARD_URL'),
      environment,
    },
    {
      id: 'maps-provider',
      category: 'maps',
      label: 'Maps / Routing',
      description: 'Delivery routes and station placement tools.',
      url: envLink('OPS_MAPS_DASHBOARD_URL'),
      environment,
    },
    {
      id: 'analytics-dashboard',
      category: 'analytics',
      label: 'Analytics Dashboard',
      description: 'Business analytics and funnel reporting.',
      url: envLink('OPS_ANALYTICS_URL', '/admin/analytics'),
      environment,
      external: false,
    },
    {
      id: 'error-tracking',
      category: 'analytics',
      label: 'Error Tracking',
      description: 'Application error monitoring (e.g. Sentry).',
      url: envLink('OPS_ERROR_TRACKING_URL'),
      environment,
      adminOnly: true,
    },
    {
      id: 'uptime-monitoring',
      category: 'analytics',
      label: 'Uptime Monitoring',
      description: 'External uptime and health checks.',
      url: envLink('OPS_UPTIME_URL'),
      environment,
      adminOnly: true,
    },
    {
      id: 'metrics-endpoint',
      category: 'analytics',
      label: 'Prometheus Metrics',
      description: 'Scrape /api/metrics with METRICS_API_KEY configured.',
      url: `${appOrigin}/api/metrics`,
      environment,
      adminOnly: true,
      external: false,
    },
    {
      id: 'shared-charging-dashboard',
      category: 'documentation',
      label: 'Shared Charging System Dashboard',
      description: 'Vendor dashboard for shared charging cabinets, fleet status, and device management.',
      url: envLink('OPS_SHARED_CHARGING_DASHBOARD_URL'),
      environment,
    },
    {
      id: 'qr-setup-guide',
      category: 'documentation',
      label: 'QR Code Setup Guide',
      description: 'How to generate and attach QR codes to physical units.',
      url: envLink('OPS_QR_SETUP_URL'),
      environment,
    },
    {
      id: 'incident-runbook',
      category: 'documentation',
      label: 'Incident Response Runbook',
      description: 'Escalation paths and recovery procedures.',
      url: envLink('OPS_INCIDENT_RUNBOOK_URL'),
      environment,
      adminOnly: true,
    },
    {
      id: 'launch-checklist',
      category: 'documentation',
      label: 'Launch Checklist',
      description: 'Pre-launch verification for events and deployments.',
      url: envLink('OPS_LAUNCH_CHECKLIST_URL'),
      environment,
    },
    {
      id: 'system-health',
      category: 'analytics',
      label: 'System Health (Ops)',
      description: 'Internal production readiness and component health.',
      url: '/admin/ops',
      environment,
      external: false,
    },
  ]

  const filtered = rawLinks.filter((link) => !link.adminOnly || isAdmin)

  const categories = Object.keys(CATEGORY_META) as OperationsHubLinkCategory[]

  return categories.map((category) => ({
    id: category,
    title: CATEGORY_META[category].title,
    description: CATEGORY_META[category].description,
    links: filtered.filter((l) => l.category === category),
  }))
}

export function resolveOperationsHubUrl(link: OperationsHubLink, appOrigin: string): string | null {
  if (!link.url) return null
  if (link.url.startsWith('http://') || link.url.startsWith('https://')) return link.url
  if (link.url.startsWith('/')) return `${appOrigin.replace(/\/$/, '')}${link.url}`
  return link.url
}
