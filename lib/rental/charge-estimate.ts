import 'server-only'

import { calculateRentalCharge } from '@/lib/stripe/types'

/** Live rental charge estimate using the same Stripe ladder as finalize/capture. */
export function estimateRentalChargeEur(durationMinutes: number): number {
  const { totalCents } = calculateRentalCharge(Math.max(0, durationMinutes))
  return Math.round(totalCents) / 100
}
