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
  iconePadrao: string
): SkillSugerido | null {
  if (!obj) return null;
  const body = texto(obj.body, 4000);
  if (!body) return null;
  return {
    name: texto(obj.name, 60) || "Untitled skill",
    description: texto(obj.description, 140),
    icon: daLista(obj.icon, iconesValidos, iconePadrao),
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
  const cruas = Array.isArray(obj.notes) ? obj.notes : [];
  const permitidas = new Set(notasDoVault);
  const notes = cruas
    .filter((n): n is string => typeof n === "string")
    .filter((n) => permitidas.has(n))
    // Sem repetidas: o mesmo caminho duas vezes anexaria a mesma nota duas
    // vezes, e a contagem do projeto passaria a mentir.
    .filter((n, i, todas) => todas.indexOf(n) === i)
    .slice(0, 10);
  return {
    name,
    icon: daLista(obj.icon, iconesValidos, iconesValidos[0] ?? "folder"),
    color: daLista(obj.color, coresValidas, coresValidas[0] ?? "default"),
    instructions: texto(obj.instructions, 2000),
    notes,
  };
}

/** A pergunta do modo guiado, se houver. Uma linha, com teto. */
export function lerPergunta(obj: Record<string, unknown> | null): string {
  return obj ? texto(obj.ask, 200) : "";
}
