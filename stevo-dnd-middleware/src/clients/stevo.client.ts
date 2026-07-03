import { env } from '../config/env';
import { StevoInstance } from '../config/locations';
import { logger } from '../utils/logger';

/**
 * Cliente HTTP isolado para a API do StevoManager v2.
 *
 * Formato validado no OpenAPI oficial (https://smv2-1.stevo.chat/swagger/doc.json,
 * "StevoManager v2 - WhatsApp API", acessível via https://doc.stevo.chat/api-reference):
 *
 *   POST {serverUrl}/user/block     body: { "number": "5538999999999" }
 *   POST {serverUrl}/user/unblock   body: { "number": "5538999999999" }
 *   GET  {serverUrl}/user/blocklist (sem body)
 *
 *   Header de autenticação: apikey: <API Key da instância>
 *   Erros: { "error": "mensagem" } com 400/401/500
 *
 * Paths, nome do header e nome do campo do telefone são configuráveis via .env
 * (STEVO_BLOCK_PATH, STEVO_API_KEY_HEADER, STEVO_PHONE_FIELD, ...) para
 * absorver mudanças futuras da API sem alterar código.
 */

export interface StevoResult {
  success: boolean;
  httpStatus?: number;
  /** Corpo da resposta do Stevo (sem dados sensíveis do nosso lado) */
  data?: unknown;
  /** Mensagem de erro resumida, segura para devolver ao GHL */
  error?: string;
}

async function stevoRequest(
  instance: StevoInstance,
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<StevoResult> {
  const url = `${instance.serverUrl.replace(/\/+$/, '')}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.STEVO_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        [env.STEVO_API_KEY_HEADER]: instance.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let data: unknown = null;
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      // Stevo responde erros como { "error": "mensagem" }
      const apiMessage =
        data && typeof data === 'object' && 'error' in data
          ? String((data as { error: unknown }).error)
          : `HTTP ${response.status}`;

      return {
        success: false,
        httpStatus: response.status,
        error: sanitizeErrorMessage(apiMessage, instance),
      };
    }

    return { success: true, httpStatus: response.status, data };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const message = isTimeout
      ? `Timeout após ${env.STEVO_TIMEOUT_MS}ms ao chamar a instância Stevo`
      : 'Falha de rede ao chamar a instância Stevo';

    logger.warn(
      { instance: instance.name, path, timeout: isTimeout },
      `Erro de rede/timeout na chamada ao Stevo: ${err instanceof Error ? err.message : String(err)}`
    );

    return { success: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

/** Garante que a apiKey nunca aparece em mensagens de erro repassadas ao GHL. */
function sanitizeErrorMessage(message: string, instance: StevoInstance): string {
  return message.split(instance.apiKey).join('[REDACTED]').slice(0, 300);
}

export const stevoClient = {
  blockUser(instance: StevoInstance, phone: string): Promise<StevoResult> {
    return stevoRequest(instance, 'POST', env.STEVO_BLOCK_PATH, {
      [env.STEVO_PHONE_FIELD]: phone,
    });
  },

  unblockUser(instance: StevoInstance, phone: string): Promise<StevoResult> {
    return stevoRequest(instance, 'POST', env.STEVO_UNBLOCK_PATH, {
      [env.STEVO_PHONE_FIELD]: phone,
    });
  },

  getBlockList(instance: StevoInstance): Promise<StevoResult> {
    return stevoRequest(instance, 'GET', env.STEVO_BLOCKLIST_PATH);
  },
};
