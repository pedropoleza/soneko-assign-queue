import 'dotenv/config';
import { z } from 'zod';

/**
 * Validação centralizada das variáveis de ambiente.
 * Os campos STEVO_API_* permitem ajustar endpoint/header/body da API do Stevo
 * sem tocar em código, caso a documentação/versão do StevoManager mude.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),

  WEBHOOK_SECRET: z.string().min(8, 'WEBHOOK_SECRET precisa ter pelo menos 8 caracteres'),

  // Ajustes finos da API do Stevo (defaults baseados na API validada; ver README)
  STEVO_API_KEY_HEADER: z.string().default('apikey'),
  STEVO_BLOCK_PATH: z.string().default('/user/block'),
  STEVO_UNBLOCK_PATH: z.string().default('/user/unblock'),
  STEVO_BLOCKLIST_PATH: z.string().default('/user/blocklist'),
  STEVO_PHONE_FIELD: z.string().default('number'),
  STEVO_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Variáveis de ambiente inválidas:');
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
