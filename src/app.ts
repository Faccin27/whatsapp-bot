import express from 'express';
import bodyParser from 'body-parser';
import webhookRoutes from './routes/webhook.route';
import { config } from './config/env';
import { logger } from './utils/logger';

const app = express();
app.use(bodyParser.json());
app.use('/', webhookRoutes);

app.listen(config.port, () => {
  logger.info(`Servidor rodando em http://localhost:${config.port}`);
});