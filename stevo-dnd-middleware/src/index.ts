import { env } from './config/env';
import { createServer } from './server';
import { logger } from './utils/logger';

const app = createServer();

app.listen(env.PORT, () => {
  logger.info(`stevo-dnd-middleware ouvindo na porta ${env.PORT}`);
});
