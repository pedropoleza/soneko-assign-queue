import express, { NextFunction, Request, Response } from 'express';
import { healthRoutes } from './routes/health.routes';
import { webhookRoutes } from './routes/webhook.routes';
import { AppError } from './utils/errors';
import { logger } from './utils/logger';

export function createServer(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use(healthRoutes);
  app.use('/webhooks', webhookRoutes);

  // 404 padrão
  app.use((_req, res) => {
    res.status(404).json({ success: false, status: 'error', message: 'Rota não encontrada' });
  });

  // Handler central de erros: converte AppError em resposta JSON limpa.
  // Nunca vaza stack trace nem dados sensíveis para o chamador.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      logger.warn({ code: err.code, path: req.path }, err.message);
      res.status(err.statusCode).json({ success: false, status: 'error', message: err.message });
      return;
    }

    // JSON malformado do body-parser
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ success: false, status: 'error', message: 'Body JSON inválido' });
      return;
    }

    logger.error({ err, path: req.path }, 'Erro não tratado');
    res.status(500).json({ success: false, status: 'error', message: 'Erro interno do servidor' });
  });

  return app;
}
