// src/assistant/model.ts
// QUEM atende a assistente de criação — e por que ela não usa o modelo do chat.
//
// Escrever um skill ou montar um projeto é trabalho de formulário: sai texto
// curto, estruturado, e o resultado é revisado por quem pediu antes de virar
// qualquer coisa. Não é a tarefa que justifica o modelo caro que você escolheu
// pra conversar. Se ela usasse o do chat, toda ajuda pra criar um skill
// cobraria o preço da conversa mais cara — e a ajuda deixaria de ser gratuita
// justamente pra quem mais precisa dela.
//
// Por isso a assistente tem modelo PRÓPRIO, e o padrão é um free do
// OpenRouter. E o padrão é DESCOBERTO, não escrito aqui: id de modelo free
// muda de nome e some do catálogo, e um id fixo no código viraria um 404 num
// dia qualquer, num lugar onde a pessoa não tem como adivinhar o que
// aconteceu. Aqui a gente procura entre os que ela já tem.

/** Onde a assistente roda. */
export interface AssistantAlvo {
  provider: string;
  model: string;
}

/** O que a escolha precisa saber das settings. */
export interface AssistantFontes {
  /** Escolha explícita da pessoa (Settings). Vazio = descobrir. */
  assistantProvider?: string;
  assistantModel?: string;
  /** Favoritos por provider — a primeira fonte, porque favorito é escolha. */
  favoriteModels?: Record<string, string[]>;
  /** Todos os modelos conhecidos por provider. */
  activeModels?: Record<string, string[]>;
}

/** No OpenRouter, free é sufixo no id. É assim que o app inteiro reconhece. */
export function ehFree(model: string): boolean {
  return (model || "").toLowerCase().endsWith(":free");
}

/**
 * Onde a assistente vai rodar, ou null quando não há nada servível.
 *
 * A ordem é a ordem da intenção: o que a pessoa escolheu, depois o que ela
 * favoritou, depois o que ela tem. null não é erro — é o estado de quem ainda
 * não configurou nada, e quem chama transforma isso num convite (é daí que o
 * onboarding começa), não numa mensagem de falha.
 */
export function escolherAssistente(s: AssistantFontes): AssistantAlvo | null {
  const escolhido = (s.assistantModel ?? "").trim();
  if (escolhido)
    return {
      provider: (s.assistantProvider ?? "openrouter").trim() || "openrouter",
      model: escolhido,
    };

  const favoritos = s.favoriteModels?.openrouter ?? [];
  const favFree = favoritos.find(ehFree);
  if (favFree) return { provider: "openrouter", model: favFree };

  const ativos = s.activeModels?.openrouter ?? [];
  const ativoFree = ativos.find(ehFree);
  if (ativoFree) return { provider: "openrouter", model: ativoFree };

  return null;
}

/**
 * Por que a assistente não está disponível — em uma frase, pra quem lê na
 * tela. null = está tudo pronto.
 *
 * Duas causas diferentes, e elas pedem coisas diferentes da pessoa: sem chave,
 * ela precisa colar uma; sem modelo, ela precisa rodar o SCAN do OpenRouter ou
 * escolher um. Uma mensagem só pras duas mandaria metade das pessoas pro lugar
 * errado.
 */
export function motivoIndisponivel(
  alvo: AssistantAlvo | null,
  temChave: (provider: string) => boolean
): string | null {
  if (!alvo)
    return "Pick an assistant model in Settings — a free OpenRouter model works.";
  if (!temChave(alvo.provider))
    return `Add your ${alvo.provider} key in Settings to use the assistant.`;
  return null;
}
