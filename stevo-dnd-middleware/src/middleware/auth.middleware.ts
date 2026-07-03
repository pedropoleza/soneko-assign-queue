import { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { UnauthorizedError } from '../utils/errors';

/**
 * Exige o header x-webhook-secret com o valor definido no .env.
 * Comparação em tempo constante para evitar timing attacks.
 */
export function requireWebhookSecret(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.header('x-webhook-secret');

  if (!provided || !safeCompare(provided, env.WEBHOOK_SECRET)) {
    next(new UnauthorizedError());
    return;
  }

  next();
}

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
