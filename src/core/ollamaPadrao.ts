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
 * O que vinha ligado de fábrica pro Ollama até a 0.9.23: quatro palpites que
 * quase nunca batiam com o que a pessoa tinha instalado, e que apareciam na
 * lista como se existissem (ver alinharAoInstalado). A fábrica agora é vazia;
 * a revisão do endereço compara com ESTES, que são os gravados no data.json
 * de quem instalou antes.
 */
export const FABRICA_ATE_0923: OllamaFabrica = {
  modelo: "llama3.2",
  ativos: ["llama3.2", "qwen2.5", "deepseek-r1", "mistral"],
};

/** O nome como o Ollama guarda: sem tag é a `latest` (`llama3.2` é
 *  `llama3.2:latest`). A tag vem depois do último `/` — um registro com
 *  porta (`host:5000/modelo`) não conta como tag. */
export function nomeCompleto(m: string): string {
  const ultimo = m.slice(m.lastIndexOf("/") + 1);
  return ultimo.includes(":") ? m : `${m}:latest`;
}

/** As listas do Ollama nas settings, do jeito que a alinharAoInstalado lê. */
export interface ListasDoOllama {
  ativos: readonly string[];
  favoritos: readonly string[];
  /** O modelo de conversa nova. */
  modelo: string;
  /** O que a última busca achou instalado — pra saber o que é NOVO. null =
   *  nunca buscou (a primeira busca depois de atualizar). */
  vistos: readonly string[] | null;
}

/** A lista de ativos ainda é a de fábrica (ou vazia): ninguém escolheu nada. */
export function listaDeFabrica(ativos: readonly string[]): boolean {
  if (ativos.length === 0) return true;
  const fabrica = FABRICA_ATE_0923.ativos;
  return ativos.length === fabrica.length && ativos.every((m) => fabrica.includes(m));
}

/**
 * As listas do Ollama depois de um /api/tags que RESPONDEU. No Ollama, o que
 * existe é o que está instalado na máquina — não um catálogo de nuvem onde
 * um modelo some por um dia e volta. Então:
 *
 * - sai de ativos, favoritos e modelo padrão o que não está instalado (era o
 *   bug: os palpites de fábrica e os modelos apagados com `ollama rm`
 *   continuavam na lista, e escolhê-los dava erro);
 * - entra nos ativos o que apareceu desde a última busca (um `ollama pull`
 *   novo). O que a pessoa escondeu e continua instalado fica escondido;
 * - na PRIMEIRA busca (sem `vistos`) não há "novo" pra saber: se sobrou algo
 *   que a pessoa já tinha ligado, a escolha dela vale e nada entra sozinho;
 *   só quando não sobra nada (os palpites de fábrica) entram os instalados;
 * - lista que acabaria sem nenhum modelo que converse ganha os instalados
 *   que conversam (vazia, ela só daria o aviso de "sem modelo");
 * - modelo de embedding não entra sozinho, nem vira padrão: ele não conversa;
 * - o modelo padrão que sumiu vira o primeiro ativo que conversa.
 *
 * A grafia da pessoa fica (`llama3.2` continua `llama3.2` se o instalado é
 * `llama3.2:latest`).
 */
export function alinharAoInstalado(
  l: ListasDoOllama,
  instalados: readonly string[],
  ehEmbedding: (m: string) => boolean
): ListasDoOllama & { vistos: readonly string[] } {
  const tem = new Set(instalados.map(nomeCompleto));
  const existe = (m: string) => tem.has(nomeCompleto(m));
  /** A grafia que o Ollama usa pra um nome que ele tem (`llama3.2` → `llama3.2:latest`). */
  const doOllama = (m: string) => instalados.find((i) => nomeCompleto(i) === nomeCompleto(m));

  // A lista de fábrica não é escolha de ninguém. Um palpite que por acaso
  // está instalado (o llama3.2 é o modelo mais baixado do Ollama) não pode
  // contar como "a pessoa ligou este" e esconder o resto do que ela tem.
  const deFabrica = l.vistos === null && l.favoritos.length === 0 && listaDeFabrica(l.ativos);
  const partida: ListasDoOllama = deFabrica
    ? { ativos: [], favoritos: [], modelo: (l.modelo && doOllama(l.modelo)) || "", vistos: null }
    : l;

  const ativos: string[] = [];
  const jaAtivos = new Set<string>();
  const ativar = (m: string) => {
    const k = nomeCompleto(m);
    if (jaAtivos.has(k)) return;
    jaAtivos.add(k);
    ativos.push(m);
  };
  for (const m of partida.ativos) if (existe(m)) ativar(m);

  // O que conta como "novo": o que a última busca não viu. Na primeira, se a
  // pessoa já tinha ligado algo instalado, tudo conta como visto.
  const vistos =
    partida.vistos !== null
      ? new Set(partida.vistos.map(nomeCompleto))
      : ativos.length > 0
        ? tem
        : new Set<string>();
  for (const m of instalados) {
    if (!vistos.has(nomeCompleto(m)) && !ehEmbedding(m)) ativar(m);
  }
  // Uma lista sem nenhum modelo que converse não serve pra nada — e quem
  // buscou os modelos quer conversar. Com algum instalado que converse,
  // entram todos (esconder volta a ser escolha a partir daí).
  if (!ativos.some((m) => !ehEmbedding(m))) {
    for (const m of instalados) if (!ehEmbedding(m)) ativar(m);
  }

  const favoritos = partida.favoritos.filter(existe);
  const modelo =
    partida.modelo && existe(partida.modelo)
      ? partida.modelo
      : (ativos.find((m) => !ehEmbedding(m)) ?? "");
  return { ativos, favoritos, modelo, vistos: [...instalados] };
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
