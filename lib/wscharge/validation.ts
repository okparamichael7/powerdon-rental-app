import { z } from 'zod'

export const wsChargeMessageBodySchema = z.object({
  messageHex: z.string().regex(/^[0-9a-fA-F]+$/, 'messageHex must be hex'),
  stationId: z.string().min(1).optional(),
  connectionId: z.string().optional(),
  remoteAddress: z.string().optional(),
  correlationId: z.string().optional(),
})

export type WsChargeMessageBody = z.infer<typeof wsChargeMessageBodySchema>
