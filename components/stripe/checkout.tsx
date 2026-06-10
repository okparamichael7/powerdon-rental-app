'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

import { startRentalCheckout, getCheckoutStatus, type StartRentalCheckoutParams } from '@/app/actions/stripe'
import { getErrorMessage } from '@/lib/errors/get-error-message'
import { formatStripeCheckoutError } from '@/lib/stripe/checkout-errors'
import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = publishableKey ? loadStripe(publishableKey) : null

// =============================================================================
// RENTAL CHECKOUT COMPONENT
// =============================================================================

interface RentalCheckoutProps {
  email: string
  name?: string
  stationId: string
  slotNumber?: number
  campaignId?: string
  depositAmount: number // In cents
  onSuccess?: (sessionCode: string, unlockToken?: string, sessionId?: string) => void
  onCancel?: () => void
  onError?: (error: string) => void
}

export function RentalCheckout({
  email,
  name,
  stationId,
  slotNumber,
  campaignId,
  depositAmount,
  onSuccess,
  onCancel,
  onError,
}: RentalCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [sessionCode, setSessionCode] = useState<string | null>(null)
  const [unlockToken, setUnlockToken] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const initKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!publishableKey) {
      const message = 'Stripe publishable key is not configured'
      setError(message)
      setLoading(false)
      onErrorRef.current?.(message)
      return
    }

    const initKey = `${stationId}:${email}:${slotNumber ?? ''}:${campaignId ?? ''}`
    if (initKeyRef.current === initKey) return
    initKeyRef.current = initKey

    let active = true

    async function initCheckout() {
      setLoading(true)
      setError(null)
      setClientSecret(null)

      try {
        const result = await startRentalCheckout({
          email,
          name,
          stationId,
          slotNumber,
          campaignId,
        })

        if (!active) return

        if (result.success && result.clientSecret && result.sessionCode) {
          setClientSecret(result.clientSecret)
          setSessionCode(result.sessionCode)
          if (result.unlockToken) setUnlockToken(result.unlockToken)
          if (result.sessionId) setSessionId(result.sessionId)
          if (result.checkoutSessionId) setCheckoutSessionId(result.checkoutSessionId)
        } else {
          const message =
            result.error ||
            (result.success && !result.clientSecret
              ? 'Stripe did not return a checkout session. Check server logs.'
              : 'Failed to start checkout')
          setError(message)
          onErrorRef.current?.(message)
        }
      } catch (err) {
        if (!active) return
        const errorMessage = getErrorMessage(err) || 'Failed to start checkout'
        setError(errorMessage)
        onErrorRef.current?.(errorMessage)
      } finally {
        if (active) setLoading(false)
      }
    }

    void initCheckout()

    return () => {
      active = false
      initKeyRef.current = null
    }
  }, [email, name, stationId, slotNumber, campaignId])

  // Handle checkout completion
  const handleComplete = useCallback(async () => {
    if (!sessionCode) return

    // Poll for status
    const maxAttempts = 30
    let attempt = 0
    
    while (attempt < maxAttempts) {
      const status = await getCheckoutStatus(
        sessionCode,
        checkoutSessionId ?? undefined,
      )
      
      if (status.status === 'completed') {
        onSuccess?.(sessionCode, unlockToken ?? undefined, sessionId ?? undefined)
        return
      }
      
      if (status.status === 'failed' || status.status === 'expired') {
        onError?.(formatStripeCheckoutError(status.error || 'Payment failed'))
        return
      }
      
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, 1000))
      attempt++
    }
    
    onError?.('Timeout waiting for payment confirmation')
  }, [sessionCode, checkoutSessionId, unlockToken, sessionId, onSuccess, onError])

  if (loading) {
    return (
      <div className="space-y-4 p-2" aria-busy="true" aria-label="Preparing checkout">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <p className="text-center text-sm text-muted-foreground">Preparing checkout…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-destructive font-medium">Unable to start checkout</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
        <button
          onClick={onCancel}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  if (!clientSecret || !stripePromise) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-destructive font-medium">Unable to load payment form</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error || 'Checkout session was not initialized. Please go back and try again.'}
        </p>
        <button
          onClick={onCancel}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Go back
        </button>
      </div>
    )
  }

  return (
    <div className="w-full min-h-[420px]">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ clientSecret, onComplete: handleComplete }}
      >
        <div className="min-h-[380px]">
          <EmbeddedCheckout />
        </div>
      </EmbeddedCheckoutProvider>
      
      <div className="mt-4 text-center">
        <p className="text-xs text-muted-foreground">
          A hold of ${(depositAmount / 100).toFixed(2)} will be placed on your card.
          You will only be charged for the actual rental time.
        </p>
        {sessionCode && (
          <p className="text-xs text-muted-foreground mt-1">
            Session: {sessionCode}
          </p>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// SIMPLE CHECKOUT WRAPPER
// =============================================================================

interface SimpleCheckoutProps {
  clientSecret: string
  onComplete?: () => void
}

export function SimpleCheckout({ clientSecret, onComplete }: SimpleCheckoutProps) {
  return (
    <EmbeddedCheckoutProvider
      stripe={stripePromise}
      options={{ clientSecret, onComplete }}
    >
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  )
}

// =============================================================================
// CHECKOUT STATUS DISPLAY
// =============================================================================

interface CheckoutStatusProps {
  sessionCode: string
  onRetry?: () => void
}

export function CheckoutStatus({ sessionCode, onRetry }: CheckoutStatusProps) {
  const [status, setStatus] = useState<{
    status: 'pending' | 'completed' | 'expired' | 'failed'
    paymentStatus?: string
    error?: string
  }>({ status: 'pending' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkStatus() {
      const result = await getCheckoutStatus(sessionCode)
      setStatus(result)
      setLoading(false)
    }

    checkStatus()
    
    // Poll while pending
    const interval = setInterval(async () => {
      if (status.status === 'pending') {
        const result = await getCheckoutStatus(sessionCode)
        setStatus(result)
        
        if (result.status !== 'pending') {
          clearInterval(interval)
        }
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [sessionCode, status.status])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner className="h-6 w-6" />
        <span className="ml-2">Checking payment status...</span>
      </div>
    )
  }

  if (status.status === 'completed') {
    return (
      <div className="rounded-xl border border-volt-success/30 bg-volt-success/10 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-volt-success/20">
          <svg className="h-6 w-6 text-volt-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-medium text-volt-success">Payment Authorized</p>
        <p className="text-sm text-muted-foreground mt-1">
          Your deposit has been secured. Proceed to the station.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Session: {sessionCode}
        </p>
      </div>
    )
  }

  if (status.status === 'failed') {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
          <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-destructive font-medium">Payment Failed</p>
        <p className="text-sm text-muted-foreground mt-1">{status.error || 'Please try again'}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </button>
        )}
      </div>
    )
  }

  if (status.status === 'expired') {
    return (
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-6 text-center">
        <p className="text-yellow-600 font-medium">Session Expired</p>
        <p className="text-sm text-muted-foreground mt-1">
          This checkout session has expired. Please start a new rental.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Start New Rental
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center p-8">
      <Spinner className="h-6 w-6" />
      <span className="ml-2">Processing payment...</span>
    </div>
  )
}
