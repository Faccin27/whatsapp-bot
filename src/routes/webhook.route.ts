import express from 'express';
import { handleWebhook } from '../controllers/webhook.controller';

const router = express.Router();
router.post('/webhook', handleWebhook);
router.get('/', (req, res) => {
  res.send('teste');
});

export default router;
