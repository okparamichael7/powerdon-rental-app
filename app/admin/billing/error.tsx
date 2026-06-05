'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function BillingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Admin Billing]', error)
  }, [error])

  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold">Billing data unavailable</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Stripe or database access failed. Verify <code className="text-xs">STRIPE_SECRET_KEY</code> and staff
            session, then retry.
          </p>
        </div>
        <Button onClick={reset}>Retry</Button>
      </CardContent>
    </Card>
  )
}
