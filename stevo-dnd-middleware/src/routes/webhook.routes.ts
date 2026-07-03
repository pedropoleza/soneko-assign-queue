import { Router } from 'express';
import { handleStevoDndWebhook } from '../controllers/webhook.controller';
import { requireWebhookSecret } from '../middleware/auth.middleware';

export const webhookRoutes = Router();

webhookRoutes.post('/ghl/stevo-dnd', requireWebhookSecret, handleStevoDndWebhook);
