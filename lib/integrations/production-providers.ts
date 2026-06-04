import type { IEmailProvider } from './index'
import type { SendEmailRequest } from '@/lib/api/types'
import { logger } from '@/lib/observability/logger'

function renderTemplateBody(request: SendEmailRequest): { subject: string; html: string } {
  const subject = `PowerDon — ${request.templateId.replace(/_/g, ' ')}`
  const html = `<p>Hello,</p><p>Notification: ${request.templateId}</p><pre>${JSON.stringify(request.data, null, 2)}</pre>`
  return { subject, html }
}

/**
 * Resend-backed email provider when RESEND_API_KEY is set.
 */
export const productionEmailProvider: IEmailProvider = {
  async sendEmail(request: SendEmailRequest) {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM || 'PowerDon <noreply@powerdon.com>'

    if (!apiKey) {
      logger.warn('RESEND_API_KEY not configured; email not sent', {
        templateId: request.templateId,
        to: request.to,
      })
      return { success: false, messageId: '' }
    }

    const { subject, html } = renderTemplateBody(request)

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [request.to],
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      logger.error('Resend email failed', { status: response.status, text, to: request.to })
      return { success: false, messageId: '' }
    }

    const data = (await response.json()) as { id?: string }
    return { success: true, messageId: data.id || '' }
  },

  async getTemplates() {
    return []
  },

  async addContact() {
    return { success: true, contactId: '' }
  },

  async updateContactPreferences() {
    return { success: true }
  },

  async unsubscribeContact() {
    return { success: true }
  },
}
