// src/assistant/parse.ts
// LER a resposta da assistente — a parte que não pode confiar em nada.
//
// Tudo aqui parte de um princípio: o modelo é um convidado, não um autor. Ele
// devolve texto, e texto é palpite. Um nome de ícone inventado não dá erro em
// lugar nenhum — `setIcon` simplesmente não desenha, e o projeto nasce com um
// buraco no lugar do brasão. Uma cor fora da paleta entra como CSS inválido e
// some. Um modo que não existe quebra o skill na hora de usar. Nenhuma dessas
// falhas grita; todas aparecem depois, longe daqui.
//
// Então nada do que ele diz vira dado sem passar por uma lista nossa. O que
// não casa não vira erro: vira o padrão. Um skill com o ícone errado ainda é
// um skill, e obrigar a pessoa a recomeçar porque o modelo escreveu
// "sparkles-2" seria cobrar dela o erro dele.

import { CHAT_MODES } from "../core/session";

/** O que a assistente pode devolver: uma pergunta, ou o rascunho pronto. */
export interface RespostaAssistente<T> {
  /** Modo guiado: ela ainda quer saber mais uma coisa. */
  ask?: string;
  /** Modo direto (ou fim do guiado): o rascunho. */
  draft?: T;
}

/**
 * Acha o JSON no meio do que veio.
 *
 * Modelo instruído a responder só JSON responde só JSON quase sempre — e o
 * "quase" é o problema. Vem cercado de crase, vem com "Here's the JSON:" na
 * frente, vem com um parágrafo de despedida atrás. Em vez de brigar por
 * obediência no prompt, a gente recorta: do primeiro `{` até o último `}`.
 */
export function recortarJson(bruto: string): string | null {
  const texto = (bruto || "").trim();
  if (!texto) return null;
  // Cerca de código, com ou sem a linguagem escrita.
  const semCerca = texto.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const abre = semCerca.indexOf("{");
  const fecha = semCerca.lastIndexOf("}");
  if (abre < 0 || fecha <= abre) return null;
  return semCerca.slice(abre, fecha + 1);
}

/** O JSON como objeto, ou null se não der. Nunca lança. */
export function lerObjeto(bruto: string): Record<string, unknown> | null {
  const recorte = recortarJson(bruto);
  if (!recorte) return null;
  try {
    const v = JSON.parse(recorte) as unknown;
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Texto limpo e com teto. Sem teto, um modelo prolixo enche um campo de uma
 *  linha com um parágrafo — e o formulário fica impossível de revisar. */
function texto(v: unknown, teto: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(/^```(?:\w+)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim()
    .slice(0, teto);
}

/** Uma escolha só vale se estiver na NOSSA lista. Fora dela, o padrão. */
function daLista(v: unknown, lista: readonly string[], padrao: string): string {
  return typeof v === "string" && lista.includes(v) ? v : padrao;
}

export interface SkillSugerido {
  name: string;
  description: string;
  icon: string;
  color: string;
  mode: string;
  body: string;
}

export interface ProjetoSugerido {
  name: string;
  icon: string;
  color: string;
  instructions: string;
  /** Caminhos de notas pra anexar como fonte. */
  notes: string[];
}

/**
 * Rascunho de SKILL a partir do objeto cru.
 *
 * Devolve null só quando não há corpo: o corpo é o skill (sem ele o parser da
 * nota descarta o arquivo e o skill some no mesmo segundo em que foi criado).
 * Todo o resto tem padrão.
 */
export function lerSkill(
  obj: Record<string, unknown> | null,
  iconesValidos: readonly string[],
  iconePadrao: string,
  coresValidas: readonly string[] = ["default"]
): SkillSugerido | null {
  if (!obj) return null;
  const body = texto(obj.body, 4000);
  if (!body) return null;
  return {
    name: texto(obj.name, 60) || "Untitled skill",
    description: texto(obj.description, 140),
    icon: daLista(obj.icon, iconesValidos, iconePadrao),
    color: daLista(obj.color, coresValidas, "default"),
    // "" é válido e é o padrão: quer dizer "abre onde eu estiver".
    mode: daLista(obj.mode, ["", ...CHAT_MODES], ""),
    body,
  };
}

/**
 * Rascunho de PROJETO.
 *
 * `notasDoVault` é a lista que FOI ENVIADA. Sugestão que não está nela é
 * descartada sem dó: o modelo inventa caminho plausível ("Projects/Thesis.md")
 * com uma facilidade que assusta, e anexar uma fonte que não existe deixaria o
 * projeto quebrado de um jeito que só aparece na primeira conversa.
 */
export function lerProjeto(
  obj: Record<string, unknown> | null,
  iconesValidos: readonly string[],
  coresValidas: readonly string[],
  notasDoVault: readonly string[]
): ProjetoSugerido | null {
  if (!obj) return null;
  const name = texto(obj.name, 60);
  if (!name) return null;
  const notes = notasValidas(obj.notes, notasDoVault);
  return {
    name,
    icon: daLista(obj.icon, iconesValidos, iconesValidos[0] ?? "folder"),
    color: daLista(obj.color, coresValidas, coresValidas[0] ?? "default"),
    instructions: texto(obj.instructions, 2000),
    notes,
  };
}

/**
 * Os caminhos que a assistente devolveu, filtrados pelo que EXISTE.
 *
 * Nada que ela escreva vira fonte de um projeto sem estar na lista do vault
 * que foi mandada pra ela: modelo pequeno inventa caminho plausível, e uma
 * fonte que aponta pra nota nenhuma é um projeto que diz saber uma coisa que
 * não sabe.
 */
function notasValidas(
  cruas: unknown,
  notasDoVault: readonly string[],
  fora: readonly string[] = []
): string[] {
  const permitidas = new Set(notasDoVault);
  const jaTem = new Set(fora);
  return (Array.isArray(cruas) ? cruas : [])
    .filter((n): n is string => typeof n === "string")
    .filter((n) => permitidas.has(n) && !jaTem.has(n))
    // Sem repetidas: o mesmo caminho duas vezes anexaria a mesma nota duas
    // vezes, e a contagem do projeto passaria a mentir.
    .filter((n, i, todas) => todas.indexOf(n) === i)
    .slice(0, 10);
}

/**
 * As notas que a assistente achou pra um projeto (promptNotas). Sem as que já
 * estão escolhidas — uma sugestão repetida parece um botão que não fez nada.
 */
export function lerNotas(
  obj: Record<string, unknown> | null,
  notasDoVault: readonly string[],
  jaEscolhidas: readonly string[] = []
): string[] {
  return obj ? notasValidas(obj.notes, notasDoVault, jaEscolhidas) : [];
}

/**
 * UM campo de texto, quando a assistente escreve só ele (a descrição de um
 * skill, as instruções de um projeto). Vazio = não veio nada aproveitável.
 */
export function lerTexto(
  obj: Record<string, unknown> | null,
  teto: number
): string {
  return obj ? texto(obj.text, teto) : "";
}

/** A pergunta do modo guiado, se houver. Uma linha, com teto. */
export function lerPergunta(obj: Record<string, unknown> | null): string {
  return obj ? texto(obj.ask, 200) : "";
}

/**
 * As OPÇÕES da pergunta — o que transforma o interrogatório em toques.
 *
 * Responder por escrito três perguntas num celular é trabalho; tocar em três
 * pastilhas é um gesto. As opções não são obrigatórias (às vezes a pergunta é
 * mesmo aberta), e o campo de texto continua ali pra quem quiser dizer outra
 * coisa — elas são atalho, não gaiola.
 *
 * TRÊS, sempre. A quarta é nossa — o "eu escrevo" — e ela precisa existir em
 * toda pergunta, com o mesmo texto e no mesmo lugar: é a saída, e saída que
 * muda de nome e de posição não é saída. Se o modelo mandar mais, o excedente
 * cai fora; se mandar menos, é o que há (a pergunta ainda funciona).
 *
 * Trinta caracteres por pastilha: pastilha com frase dentro não se lê de
 * relance, e quatro delas numa tela de 375px precisam caber em duas fileiras.
 */
export function lerOpcoes(obj: Record<string, unknown> | null): string[] {
  const cruas = obj && Array.isArray(obj.options) ? obj.options : [];
  return cruas
    .filter((o): o is string => typeof o === "string")
    .map((o) => o.trim().slice(0, 30))
    .filter(Boolean)
    .filter((o, i, todas) => todas.indexOf(o) === i)
    .slice(0, 3);
}
