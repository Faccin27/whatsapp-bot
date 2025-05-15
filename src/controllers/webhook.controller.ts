import { Request, Response } from 'express';
import { gerarRespostaComHistorico } from '../services/conversation-handler';
import { inicializarLimpezaDeConversas } from '../services/conversation-handler';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import fetch from 'node-fetch';

// Inicializa o sistema de limpeza de conversas
inicializarLimpezaDeConversas();

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
    // Gera resposta com histórico de conversa
    const resposta = await gerarRespostaComHistorico(chatId, mensagem);

    // Envia resposta para o WAHA
    await fetch(config.wahaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          text: resposta,
          session: 'default',
        }),
      });

    logger.info(`Mensagem enviada com sucesso para ${chatId}`);
    res.sendStatus(200);
  } catch (error) {
    logger.error(`Erro ao processar mensagem: ${error}`);
    res.status(500).send('Erro interno ao processar mensagem');
  }
};
