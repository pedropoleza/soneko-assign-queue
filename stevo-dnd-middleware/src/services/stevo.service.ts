import { stevoClient } from '../clients/stevo.client';
import { auditService } from './audit.service';
import { locationService } from './location.service';
import { normalizePhone } from '../utils/phone-normalizer';
import { WebhookPayload } from '../schemas/webhook.schema';

export interface InstanceResult {
  instance: string;
  success: boolean;
  error?: string;
}

export interface ProcessOutcome {
  status: 'success' | 'partial_success' | 'error';
  normalizedPhone: string;
  results: InstanceResult[];
}

/**
 * Orquestra o fluxo: resolve location -> normaliza telefone -> chama o Stevo
 * em cada instância ativa (em paralelo) -> audita -> consolida o resultado.
 */
export const stevoService = {
  async processWebhook(payload: WebhookPayload): Promise<ProcessOutcome> {
    const { config, instances } = locationService.getTargetInstances(payload.locationId);
    const normalizedPhone = normalizePhone(payload.phone);

    const results: InstanceResult[] = await Promise.all(
      instances.map(async (instance): Promise<InstanceResult> => {
        const call =
          payload.action === 'block'
            ? stevoClient.blockUser(instance, normalizedPhone)
            : stevoClient.unblockUser(instance, normalizedPhone);

        const result = await call;

        auditService.record({
          action: payload.action,
          locationId: payload.locationId,
          clientName: config.clientName,
          contactId: payload.contactId,
          normalizedPhone,
          instance: instance.name,
          success: result.success,
          message: result.success ? `HTTP ${result.httpStatus}` : result.error ?? 'erro desconhecido',
          source: payload.source,
          reason: payload.reason,
        });

        return {
          instance: instance.name,
          success: result.success,
          ...(result.success ? {} : { error: result.error ?? 'Erro desconhecido na instância' }),
        };
      })
    );

    const succeeded = results.filter((r) => r.success).length;
    const status: ProcessOutcome['status'] =
      succeeded === results.length ? 'success' : succeeded > 0 ? 'partial_success' : 'error';

    return { status, normalizedPhone, results };
  },
};
