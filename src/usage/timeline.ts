// src/usage/timeline.ts
// A SÉRIE NO TEMPO: quanto entrou e quanto saiu, data a data — o que o
// gráfico da página de uso desenha.
//
// Ela não soma nada por conta própria: parte do `byDay` que a agregação já
// entrega (usage/aggregate), o mesmo do total lá em cima. O que mora aqui é
// só a decisão de COMO o tempo é contado — de dia em dia num recorte curto,
// de semana em semana num médio, de mês em mês num longo.
//
// O passo muda porque a largura não muda: noventa colunas num telefone são
// noventa fios de um pixel, e um ano são trezentos e sessenta e cinco. O
// desenho tem que continuar sendo legível quando o recorte cresce.

import type { UsageBucket } from "./aggregate";

const DIA_MS = 86_400_000;

export const MESES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-09-11" → "Sep 11" (ou "Sep 11, 2026"). */
export function diaCurto(iso: string, comAno = false): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  const s = `${MESES[m - 1]} ${d}`;
  return comAno ? `${s}, ${a}` : s;
}

/** De quanto em quanto tempo as colunas contam. */
export type Passo = "day" | "week" | "month";

/** Uma coluna do gráfico: um pedaço de tempo, com o que entrou e o que saiu. */
export interface Coluna {
  /** O primeiro dia do pedaço, "YYYY-MM-DD" em UTC — a chave e a ordem. */
  inicio: string;
  /** Curto, pro eixo ("Sep 11", "Sep 8", "Sep"). */
  rotulo: string;
  /** Inteiro, pra quem foi ler ("Sep 8 – Sep 14, 2026"). */
  titulo: string;
  entrada: number;
  saida: number;
  total: number;
  chats: number;
}

/** "YYYY-MM-DD" (UTC) → instante. */
function ms(dia: string): number {
  return Date.parse(`${dia}T00:00:00Z`);
}

/** Instante → "YYYY-MM-DD" (UTC), a MESMA chave que a agregação usa. */
function chave(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Quantos dias vão de um ao outro, contando os dois. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((ms(ate) - ms(de)) / DIA_MS) + 1;
}

/**
 * O passo que cabe num intervalo.
 *
 * Os cortes são de largura, não de calendário: cerca de 31 colunas é o que um
 * telefone desenha com uma coluna ainda tocável; 26 semanas cobrem meio ano
 * no mesmo espaço; daí pra frente, mês.
 */
export function passoDe(dias: number): Passo {
  if (dias <= 31) return "day";
  if (dias <= 182) return "week";
  return "month";
}

/** O começo do pedaço de tempo em que um instante cai. Semana começa na SEGUNDA
 *  (é como o calendário do cartão da home desenha o mês). */
function inicioDoPasso(t: number, passo: Passo): number {
  const d = new Date(t);
  if (passo === "week") {
    const dow = (d.getUTCDay() + 6) % 7;
    return t - dow * DIA_MS;
  }
  if (passo === "month") {
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  }
  return t;
}

function rotuloDe(inicio: string, passo: Passo): string {
  if (passo === "month") {
    const m = Number(inicio.split("-")[1]);
    return MESES[m - 1] ?? inicio;
  }
  return diaCurto(inicio);
}

function tituloDe(inicio: string, fim: string, passo: Passo): string {
  const ano = inicio.slice(0, 4);
  if (passo === "day") return diaCurto(inicio, true);
  if (passo === "month") {
    const m = Number(inicio.split("-")[1]);
    return `${MESES[m - 1] ?? inicio} ${ano}`;
  }
  return `${diaCurto(inicio)} – ${diaCurto(fim)}, ${ano}`;
}

/**
 * A janela que o gráfico cobre.
 *
 * Numa janela de N dias é ela mesma, terminando hoje — dia sem conversa entra
 * como coluna vazia, porque não ter usado também é o que o desenho conta.
 * Em "All time" é do primeiro ao último dia que tem conversa.
 *
 * Nos dois casos ela se ESTICA pra caber todo dia que a agregação trouxe: o
 * filtro de período corta por instante (agora − N×24h) e o `byDay` indexa por
 * dia em UTC, então uma conversa pode passar no filtro e cair um dia antes do
 * começo da janela. Sem esticar, ela sumia do gráfico e continuava no total.
 */
export function janelaDoGrafico(
  dias: number,
  byDay: Record<string, UsageBucket>,
  agora: number = Date.now()
): { de: string; ate: string } | null {
  const chaves = Object.keys(byDay).filter((k) => Number.isFinite(ms(k))).sort();
  if (chaves.length === 0) return null;
  const primeira = chaves[0];
  const ultima = chaves[chaves.length - 1];
  if (dias <= 0) return { de: primeira, ate: ultima };
  const hoje = chave(agora);
  const inicio = chave(ms(hoje) - (dias - 1) * DIA_MS);
  return {
    de: inicio < primeira ? inicio : primeira,
    ate: hoje > ultima ? hoje : ultima,
  };
}

/**
 * As colunas do gráfico, da mais antiga pra mais nova.
 *
 * Todo pedaço de tempo da janela entra, inclusive os zerados: buraco no meio
 * de uma série temporal é informação (você não usou), e uma série que só
 * mostra os dias cheios encosta um pico no outro e mente sobre o ritmo.
 */
export function serieDoTempo(
  byDay: Record<string, UsageBucket>,
  de: string,
  ate: string,
  passo: Passo
): Coluna[] {
  const inicio = ms(de);
  const fim = ms(ate);
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || fim < inicio) return [];

  const colunas: Coluna[] = [];
  const porInicio = new Map<string, Coluna>();

  // Primeiro os pedaços VAZIOS, na ordem — assim a série nasce contínua e o
  // que vier do byDay só preenche.
  for (let t = inicioDoPasso(inicio, passo); t <= fim; ) {
    const k = chave(t);
    const proximo =
      passo === "month"
        ? Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth() + 1, 1)
        : t + (passo === "week" ? 7 : 1) * DIA_MS;
    // O fim do pedaço nunca passa do fim da janela: um pedaço que termina no
    // futuro anunciaria dias que ainda não aconteceram.
    const ultimoDia = chave(Math.min(proximo - DIA_MS, fim));
    const col: Coluna = {
      inicio: k,
      rotulo: rotuloDe(k, passo),
      titulo: tituloDe(k, ultimoDia, passo),
      entrada: 0,
      saida: 0,
      total: 0,
      chats: 0,
    };
    colunas.push(col);
    porInicio.set(k, col);
    t = proximo;
  }

  for (const [dia, b] of Object.entries(byDay)) {
    const t = ms(dia);
    if (!Number.isFinite(t) || t < inicio || t > fim) continue;
    const col = porInicio.get(chave(inicioDoPasso(t, passo)));
    if (!col) continue;
    col.entrada += b.tokensIn;
    col.saida += b.tokensOut;
    col.total += b.tokensIn + b.tokensOut;
    col.chats += b.chats;
  }

  return colunas;
}

/** A coluna mais alta — é ela que dá a escala, e o gráfico anuncia o valor
 *  dela pra altura significar alguma coisa. */
export function picoDa(colunas: readonly Coluna[]): number {
  return colunas.reduce((p, c) => (c.total > p ? c.total : p), 0);
}
