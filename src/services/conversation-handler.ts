import { config } from "../config/env";
import { logger } from "../utils/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const systemPrompt = `
Você é Ana, assistente virtual da clínica Vitaterapia de fisioterapia e reabilitação física.

DIRETRIZES IMPORTANTES:
- Seja concisa e objetiva nas respostas (máximo 3-4 frases).
- Não se apresente novamente se já estiver em uma conversa em andamento.
- Mantenha um tom cordial e profissional, mas direto.
- Responda apenas sobre os serviços que a Vitaterapia oferece.

Serviços da Vitaterapia:
- Fisioterapia para dores musculoesqueléticas e reabilitação
- Fisioterapia neurológica e respiratória
- Técnicas: RPG, pilates clínico, terapia manual, eletroterapia
- Atendimento domiciliar em casos especiais

Horários: Segunda a sexta (8h-20h), Sábado (8h-14h)
Valores: Consulta inicial R$180, Sessões a partir de R$130
Contato: (XX) XXXX-XXXX, WhatsApp (XX) 9XXXX-XXXX
Endereço: Rua das Flores, 123, Centro
`;

// Armazenar histórico de conversa por chatId
const conversationHistory = new Map<string, Array<{ role: string, parts: string }>>();

// Tempo limite para considerar uma conversa "expirada" (em milissegundos)
const CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutos
const lastActivity = new Map<string, number>();

/**
 * Limpa conversas inativas periodicamente
 */
export function inicializarLimpezaDeConversas(): void {
  setInterval(() => {
    const now = Date.now();
    for (const [chatId, lastTime] of lastActivity.entries()) {
      if (now - lastTime > CONVERSATION_TIMEOUT) {
        conversationHistory.delete(chatId);
        lastActivity.delete(chatId);
        logger.info(`Conversa expirada para ${chatId}`);
      }
    }
  }, 5 * 60 * 1000); // Verifica a cada 5 minutos
}

/**
 * Gera uma resposta da IA mantendo o histórico da conversa
 */
export async function gerarRespostaComHistorico(chatId: string, mensagem: string): Promise<string> {
  try {
    // Atualiza o timestamp de última atividade
    lastActivity.set(chatId, Date.now());
    
    // Inicializa o histórico se não existir
    if (!conversationHistory.has(chatId)) {
      conversationHistory.set(chatId, [
        { role: "user", parts: "Olá" },
        { role: "model", parts: "Olá! Sou Ana, assistente virtual da Vitaterapia. Como posso ajudar você hoje?" }
      ]);
    }
    
    // Obtém histórico atual
    const history = conversationHistory.get(chatId)!;
    
    // Adiciona a nova mensagem do usuário ao histórico
    history.push({ role: "user", parts: mensagem });
    
    // Cria uma sessão de chat com o histórico
    const chat = model.startChat({
      history: history.slice(0, -1).map(msg => ({
        role: msg.role,
        parts: [{ text: msg.parts }]
      })), // Exclui a mensagem mais recente que acabamos de adicionar
      generationConfig: { 
        temperature: 0.7,
        maxOutputTokens: 200 // Limita o tamanho da resposta
      },
    });
    
    // Envia a mensagem mais recente
    const result = await chat.sendMessage(`${systemPrompt}\n\nUsuário: ${mensagem}`);
    const resposta = await result.response.text();
    
    // Adiciona a resposta ao histórico
    history.push({ role: "model", parts: resposta });
    
    // Limita o tamanho do histórico para não crescer infinitamente
    if (history.length > 20) {
      // Mantém a primeira interação (apresentação) e as 19 mais recentes
      const firstInteraction = history.slice(0, 2);
      const recentInteractions = history.slice(-18);
      conversationHistory.set(chatId, [...firstInteraction, ...recentInteractions]);
    }
    
    logger.info(`Resposta para ${chatId}: ${resposta.substring(0, 50)}...`);
    return resposta;
    
  } catch (error: any) {
    logger.error(`Erro ao gerar resposta: ${error.message}`);
    return "Desculpe, estou com dificuldades técnicas no momento. Pode tentar novamente mais tarde?";
  }
}
