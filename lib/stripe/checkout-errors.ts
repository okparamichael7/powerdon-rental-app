/** Map Stripe/client checkout errors to user-facing rental messages. */
export function formatStripeCheckoutError(message: string): string {
  const lower = message.toLowerCase()
  if (
    lower.includes('consumer_verification_code_invalid') ||
    lower.includes('verification code is incorrect')
  ) {
    return 'The bank verification code was incorrect. Check the code from your bank and try again.'
  }
  if (lower.includes('card_declined') || lower.includes('card was declined')) {
    return 'Your card was declined. Try a different payment method.'
  }
  if (lower.includes('session not found')) {
    return 'Your rental session could not be found. Please go back and start checkout again.'
  }
  return message
}
