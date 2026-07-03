import { NextFunction, Request, Response } from 'express';
import { webhookPayloadSchema } from '../schemas/webhook.schema';
import { stevoService } from '../services/stevo.service';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * POST /webhooks/ghl/stevo-dnd
 *
 * Recebe o Custom Webhook do GHL, valida, processa e responde:
 *  - 200 success          -> todas as instâncias OK
 *  - 207 partial_success  -> parte das instâncias falhou
 *  - 502 error            -> todas as instâncias falharam
 *  - 4xx                  -> erros de validação/autenticação/configuração
 */
export async function handleStevoDndWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = webhookPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((i) => `${i.path.join('.') || 'payload'}: ${i.message}`)
        .join('; ');
      throw new ValidationError(`Payload inválido — ${detail}`);
    }

    const payload = parsed.data;
    logger.info(
      { action: payload.action, locationId: payload.locationId, contactId: payload.contactId, source: payload.source },
      'Webhook recebido'
    );

    const outcome = await stevoService.processWebhook(payload);

    const httpStatus =
      outcome.status === 'success' ? 200 : outcome.status === 'partial_success' ? 207 : 502;

    res.status(httpStatus).json({
      success: outcome.status === 'success',
      status: outcome.status,
      action: payload.action,
      locationId: payload.locationId,
      contactId: payload.contactId,
      phone: outcome.normalizedPhone,
      results: outcome.results,
    });
  } catch (err) {
    next(err);
  }
}
