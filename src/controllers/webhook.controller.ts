import { Request, Response } from 'express';
import { gerarRespostaGemini } from '../services/gemini.service';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import fetch from 'node-fetch';

export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body?.payload;
  const mensagem = payload?.body;
  const chatId = payload?.from;

  if (!mensagem || !chatId) {
    logger.error('Requisição inválida. payload.body ou payload.from ausente.');
    res.status(400).send('Mensagem inválida');
    return;
  }

  try {
    const resposta = await gerarRespostaGemini(mensagem);

    await fetch(config.wahaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          text: resposta,
          session: 'default',
        }),
      });

    logger.info(`Mensagem enviada para ${chatId}`);
    res.sendStatus(200);
  } catch (error) {
    logger.error(`Erro ao processar mensagem: ${error}`);
    res.sendStatus(500);
  }
};
