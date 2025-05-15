import { config } from '../config/env';
import { logger } from '../utils/logger';
import { gerarRespostaComHistorico } from './conversation-handler';

// Função legada - mantida para compatibilidade
export async function gerarRespostaGemini(pergunta: string): Promise<string> {
  try {
    // Aqui utilizamos o novo serviço com um chatId genérico
    // para manter compatibilidade com código existente
    const resposta = await gerarRespostaComHistorico('legacy-session', pergunta);
    return resposta;
  } catch (error: any) {
    logger.error("Erro ao chamar IA: " + error.message);
    return "Desculpe, não consegui responder.";
  }
}
