import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // Redação defensiva: mesmo que alguém logue um objeto de instância por engano,
  // a apiKey nunca aparece na saída.
  redact: {
    paths: ['apiKey', '*.apiKey', '*.*.apiKey', 'headers.apikey', 'headers.Authorization'],
    censor: '[REDACTED]',
  },
  transport: isDev
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
    : undefined,
});
