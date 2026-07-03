import { z } from 'zod';

/**
 * Payload esperado do Custom Webhook do GoHighLevel.
 * Campos extras enviados pelo GHL são ignorados (passthrough não é necessário).
 */
export const webhookPayloadSchema = z.object({
  action: z.enum(['block', 'unblock'], {
    errorMap: () => ({ message: 'action deve ser "block" ou "unblock"' }),
  }),
  locationId: z.string().min(1, 'locationId é obrigatório'),
  contactId: z.string().min(1, 'contactId é obrigatório'),
  phone: z.string().min(1, 'phone é obrigatório'),
  email: z.string().optional(),
  source: z.string().optional().default('unknown'),
  reason: z.string().optional().default(''),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
