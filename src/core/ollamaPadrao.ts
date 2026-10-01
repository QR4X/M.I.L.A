// src/core/ollamaPadrao.ts
// O Ollama começa DESLIGADO.
//
// Até a 0.9.19 ele vinha com `http://localhost:11434` de fábrica, e endereço
// preenchido é o que faz um provider contar como configurado: ele aparecia
// aceso no trilho e escolhível pra quem nunca instalou o Ollama — que mandava
// a primeira mensagem e ganhava um erro de rede. No celular nem existe
// localhost com Ollama. Agora o campo nasce vazio e quem usa coloca o
// endereço, como faz com a chave dos outros.
//
// Quem já tinha instalado ficou com o endereço de fábrica GRAVADO no
// data.json (a gravação leva as settings inteiras). A migração daqui roda uma
// vez e separa quem USA o Ollama de quem só herdou o padrão.

export const OLLAMA_LOCAL = "http://localhost:11434";

/** O pedaço do data.json salvo que diz se a pessoa usa o Ollama. */
export interface OllamaSalvo {
  ollamaEndpoint?: unknown;
  ollamaPadraoRevisto?: unknown;
  defaultProvider?: unknown;
  ollamaModel?: unknown;
  providerStatus?: Record<string, { ok?: unknown } | undefined>;
  favoriteModels?: Record<string, unknown>;
  activeModels?: Record<string, unknown>;
  roleModels?: Record<string, { provider?: unknown } | undefined>;
  modelProvider?: Record<string, unknown>;
}

/** O que vem de fábrica pro Ollama — e por isso não conta como uso. */
export interface OllamaFabrica {
  modelo: string;
  ativos: readonly string[];
}

/**
 * Algum rastro de uso do Ollama nas settings salvas. O que é igual ao de
 * fábrica não conta: a gravação leva as settings inteiras, então a lista de
 * modelos padrão do Ollama está no data.json de todo mundo.
 */
export function usaOllama(s: OllamaSalvo, fabrica: OllamaFabrica): boolean {
  const lista = (v: unknown): v is unknown[] => Array.isArray(v) && v.length > 0;
  const ativos = s.activeModels?.ollama;
  const ativosMexidos =
    lista(ativos) &&
    (ativos.length !== fabrica.ativos.length ||
      ativos.some((m) => !fabrica.ativos.includes(m as string)));
  return (
    s.defaultProvider === "ollama" ||
    s.providerStatus?.ollama?.ok === true ||
    (typeof s.ollamaModel === "string" &&
      s.ollamaModel !== "" &&
      s.ollamaModel !== fabrica.modelo) ||
    lista(s.favoriteModels?.ollama) ||
    ativosMexidos ||
    Object.values(s.roleModels ?? {}).some((r) => r?.provider === "ollama") ||
    Object.values(s.modelProvider ?? {}).some((p) => p === "ollama")
  );
}

/**
 * O endereço do Ollama depois da revisão única — ou null quando não há o que
 * mudar (já revisto, vazio, um endereço que não é o de fábrica, ou quem usa).
 */
export function revisarOllamaPadrao(
  s: OllamaSalvo,
  fabrica: OllamaFabrica
): string | null {
  if (s.ollamaPadraoRevisto === true) return null;
  if (s.ollamaEndpoint !== OLLAMA_LOCAL) return null;
  return usaOllama(s, fabrica) ? null : "";
}
