import { Request, Response } from 'express';
import { gerarRespostaComHistorico } from '../services/conversation-handler';
import { inicializarLimpezaDeConversas } from '../services/conversation-handler';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import fetch from 'node-fetch';

inicializarLimpezaDeConversas();

export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body?.payload;
  
  if (!payload || !payload.body || !payload.from) {
    logger.error('Requisição inválida. payload incompleto.');
    res.status(400).send('Mensagem inválida');
    return;
  }

  const mensagem = payload.body;
  const chatId = payload.from;
  const mensagemTimestamp = payload.timestamp;
  const agora = Math.floor(Date.now() / 1000);
  const LIMITE_TEMPO = 10; // segundos

  if (!mensagemTimestamp || agora - mensagemTimestamp > LIMITE_TEMPO) {
    logger.info(`Ignorando mensagem antiga de ${chatId}. Timestamp: ${mensagemTimestamp}`);
    res.status(200).send('Mensagem antiga ignorada');
    return;
  }

  const isGroupChat = chatId.includes('-');
  if (isGroupChat) {
    logger.info(`Ignorando mensagem de grupo: ${chatId}`);
    res.status(200).send('Mensagem de grupo ignorada');
    return;
  }

  const isSelfMessage = payload.fromMe === true;
  if (isSelfMessage) {
    logger.info(`Ignorando mensagem própria para: ${chatId}`);
    res.status(200).send('Mensagem própria ignorada');
    return;
  }

  try {
    const resposta = await gerarRespostaComHistorico(chatId, mensagem);

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
