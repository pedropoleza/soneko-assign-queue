import { env } from './env';

/**
 * Uma instância Stevo (um número de WhatsApp conectado no StevoManager).
 */
export interface StevoInstance {
  /** Nome amigável, usado nos logs e na resposta ao GHL */
  name: string;
  /** URL do servidor da instância, ex.: https://server-1.stevo.chat */
  serverUrl: string;
  /** API Key obtida no painel da instância (StevoManager V2) */
  apiKey: string;
  /** Instâncias inativas são ignoradas no processamento */
  active: boolean;
}

export interface LocationConfig {
  /** Nome do cliente, apenas para logs/auditoria */
  clientName: string;
  /** Se true, bloqueia/desbloqueia em TODAS as instâncias ativas da location */
  blockOnAllInstances: boolean;
  stevoInstances: StevoInstance[];
}

/**
 * Mapa locationId (GHL) -> configuração do cliente.
 *
 * As API Keys e URLs vêm do .env — nunca hardcode segredos aqui.
 * Para cadastrar um novo cliente:
 *   1. Adicione as variáveis STEVO_<CLIENTE>_<INSTANCIA>_SERVER_URL / _API_KEY no .env
 *   2. Adicione uma entrada neste mapa com o locationId do GHL
 *
 * Evolução futura: substituir este arquivo por uma tabela em banco de dados
 * (ver README, seção "Próximos passos").
 */
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${key}`);
  }
  return value;
};

const optionalInstance = (
  name: string,
  serverUrlKey: string,
  apiKeyKey: string
): StevoInstance | null => {
  const serverUrl = process.env[serverUrlKey];
  const apiKey = process.env[apiKeyKey];
  if (!serverUrl || !apiKey) return null;
  return { name, serverUrl, apiKey, active: true };
};

export const locations: Record<string, LocationConfig> = {
  // ── Cliente 1 ────────────────────────────────────────────────────────────
  [requireEnv('GHL_CLIENT_1_LOCATION_ID')]: {
    clientName: process.env.GHL_CLIENT_1_NAME ?? 'Cliente 1',
    blockOnAllInstances: true,
    stevoInstances: [
      {
        name: 'Número Principal',
        serverUrl: requireEnv('STEVO_CLIENT_1_MAIN_SERVER_URL'),
        apiKey: requireEnv('STEVO_CLIENT_1_MAIN_API_KEY'),
        active: true,
      },
      // Segunda instância é opcional: só entra se as duas variáveis existirem
      ...([optionalInstance(
        'Número Secundário',
        'STEVO_CLIENT_1_SECONDARY_SERVER_URL',
        'STEVO_CLIENT_1_SECONDARY_API_KEY'
      )].filter((i): i is StevoInstance => i !== null)),
    ],
  },

  // ── Cliente 2 (exemplo — descomente e configure o .env) ─────────────────
  // [requireEnv('GHL_CLIENT_2_LOCATION_ID')]: {
  //   clientName: 'Cliente 2',
  //   blockOnAllInstances: true,
  //   stevoInstances: [
  //     {
  //       name: 'Número Principal',
  //       serverUrl: requireEnv('STEVO_CLIENT_2_MAIN_SERVER_URL'),
  //       apiKey: requireEnv('STEVO_CLIENT_2_MAIN_API_KEY'),
  //       active: true,
  //     },
  //   ],
  // },
};

// Sanity check no boot: falha cedo se alguma config estiver visivelmente errada.
for (const [locationId, config] of Object.entries(locations)) {
  if (config.stevoInstances.length === 0) {
    throw new Error(`Location ${locationId} (${config.clientName}) não tem nenhuma instância Stevo configurada`);
  }
  for (const instance of config.stevoInstances) {
    if (!/^https?:\/\//.test(instance.serverUrl)) {
      throw new Error(
        `Instância "${instance.name}" da location ${locationId}: serverUrl deve ser uma URL http(s) válida`
      );
    }
    if (!instance.serverUrl.startsWith('https://')) {
      // eslint-disable-next-line no-console
      console.warn(`⚠️  Instância "${instance.name}" usa serverUrl sem HTTPS — aceitável apenas em desenvolvimento`);
    }
  }
}

// Referência ao env para garantir que a validação roda antes deste módulo.
void env;
