/** Client-safe ladder pricing labels (matches lib/stripe/types DEFAULT_PRICING). */

export const LADDER_PRICING = {
  freeMinutes: 5,
  intervalMinutes: 15,
  ratePerIntervalEur: 1,
  dailyCapEur: 27,
  maxRentalHours: 24,
} as const

export function formatLadderRateLabel(): string {
  return `€${LADDER_PRICING.ratePerIntervalEur.toFixed(2)}/${LADDER_PRICING.intervalMinutes}min`
}

export function formatDailyCapLabel(dailyCap?: number): string {
  const cap = dailyCap ?? LADDER_PRICING.dailyCapEur
  return `€${cap.toFixed(2)}`
}
