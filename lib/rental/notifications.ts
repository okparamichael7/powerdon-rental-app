import 'server-only'

import { emailProvider } from '@/lib/integrations'
import { EmailTemplates } from '@/lib/integrations'
import { logger } from '@/lib/observability/logger'

export async function notifyRentalStarted(email: string, sessionCode: string): Promise<void> {
  try {
    await emailProvider.sendEmail({
      to: email,
      templateId: EmailTemplates.RENTAL_STARTED,
      data: { sessionCode },
    })
  } catch (error) {
    logger.warn('notifyRentalStarted failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function notifyRentalCompleted(
  email: string,
  sessionCode: string,
  amountCharged: number,
): Promise<void> {
  try {
    await emailProvider.sendEmail({
      to: email,
      templateId: EmailTemplates.RENTAL_COMPLETED,
      data: { sessionCode, amountCharged },
    })
  } catch (error) {
    logger.warn('notifyRentalCompleted failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function notifyDepositRefunded(email: string, amount: number): Promise<void> {
  try {
    await emailProvider.sendEmail({
      to: email,
      templateId: EmailTemplates.DEPOSIT_REFUNDED,
      data: { amount },
    })
  } catch (error) {
    logger.warn('notifyDepositRefunded failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
