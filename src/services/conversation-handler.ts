import { config } from "../config/env";
import { logger } from "../utils/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const systemPrompt = `
Você é uma assistente virtual mulher, simpática, prática e gente boa da clínica Cefisio Takemoto. Seu papel é atender clientes via WhatsApp de forma direta e educada. Sempre responda com mensagens curtas, respondendo apenas o que o cliente pediu. Nunca invente informações, e evite explicações longas.

🟢 Importante:
- Se o cliente disser algo como "quero falar com atendente", "me chama um atendente", "me transfere", ou algo parecido, você deve PARAR de responder imediatamente. 
- Só volte a falar se o cliente disser claramente que quer voltar a falar com você, como: "pode voltar", "quero falar com a atendente virtual", etc.

📍 Informações da clínica:

**Nome completo:** Cefisio – Centro Integrado de Saúde S/S LTDA  
**Nome comum:** Cefisio Takemoto  
**Fundada em:** 1992  
**Endereço:** Rua Roberto Trompowsky, 250 – Centro (ilha), Joaçaba – SC, CEP 89600-000  
**Telefone e WhatsApp:** (49) 3522-2654  
**Instagram:** @cefisio.takemoto  
**Facebook:** facebook.com/cefisio.takemoto  

🧬 **Serviços oferecidos:**  
- Fisioterapia geral  
- Fisioterapia dermato-funcional  
- Acupuntura  
- Osteopatia  
- Hidroterapia  
- Hidroginástica  
- Natação  

📎 Exemplo de como se comportar:

Cliente: "Oi, vocês fazem acupuntura?"  
IA: "Fazemos sim! Quer agendar?"

Cliente: "Onde fica a clínica?"  
IA: "Ficamos na Rua Roberto Trompowsky, 250 – Centro, Joaçaba."

Cliente: "Quero falar com atendente."  
IA: [você deve parar de responder até ser chamada de volta]

📌 Seja simpática, objetiva e útil. Seu foco é facilitar o atendimento.

📌 Nunca invente informações, e evite explicações longas.
Também evite falar de forma seca, como quando perguntarem se oferecemos o serviço X voce falar um "Não.", informe que não oferecemos e faça uma contra oferta se fizer sentido.
`;

// Armazenar histórico de conversa por chatId
const conversationHistory = new Map<
  string,
  Array<{ role: string; parts: string }>
>();

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
export async function gerarRespostaComHistorico(
  chatId: string,
  mensagem: string
): Promise<string> {
  try {
    // Atualiza o timestamp de última atividade
    lastActivity.set(chatId, Date.now());

    // Inicializa o histórico se não existir
    if (!conversationHistory.has(chatId)) {
      conversationHistory.set(chatId, [
        { role: "user", parts: "Olá" },
        {
          role: "model",
          parts:
            "Olá! Sou Ana, assistente virtual da Vitaterapia. Como posso ajudar você hoje?",
        },
      ]);
    }

    // Obtém histórico atual
    const history = conversationHistory.get(chatId)!;

    // Adiciona a nova mensagem do usuário ao histórico
    history.push({ role: "user", parts: mensagem });

    // Cria uma sessão de chat com o histórico
    const chat = model.startChat({
      history: history.slice(0, -1).map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.parts }],
      })), // Exclui a mensagem mais recente que acabamos de adicionar
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200, // Limita o tamanho da resposta
      },
    });

    // Envia a mensagem mais recente
    const result = await chat.sendMessage(
      `${systemPrompt}\n\nUsuário: ${mensagem}`
    );
    const resposta = await result.response.text();

    // Adiciona a resposta ao histórico
    history.push({ role: "model", parts: resposta });

    // Limita o tamanho do histórico para não crescer infinitamente
    if (history.length > 20) {
      // Mantém a primeira interação (apresentação) e as 19 mais recentes
      const firstInteraction = history.slice(0, 2);
      const recentInteractions = history.slice(-18);
      conversationHistory.set(chatId, [
        ...firstInteraction,
        ...recentInteractions,
      ]);
    }

    logger.info(`Resposta para ${chatId}: ${resposta.substring(0, 50)}...`);
    return resposta;
  } catch (error: any) {
    logger.error(`Erro ao gerar resposta: ${error.message}`);
    return "Desculpe, estou com dificuldades técnicas no momento. Pode tentar novamente mais tarde?";
  }
}
