// src/usage/page.ts
// As contas da PÁGINA de uso que não são soma: em que unidade ela fala, quanto
// cada modelo pesa, quais conversas sobem pro topo, que período o recorte
// cobre de fato e quais filtros valem a pena mostrar.
//
// A soma continua sendo UMA só (aggregate.ts), a mesma do cartão da home e do
// relatório. Isto aqui só decide como DIZER o que ela já disse — e mora fora
// do componente pra ser testado sem o Obsidian.

import type { ChatUsageRow, UsageAggregate, UsageBucket } from "./aggregate";
import type { Opcao, UsageFilter } from "./filters";

/**
 * A unidade da página: dinheiro quando houve dinheiro, tokens quando não.
 *
 * É UMA pra página inteira. O número grande, a média, a fatia de cada modelo
 * e a ordem das listas falam a mesma língua — um anel de 40% de TOKENS ao
 * lado de um valor em DÓLAR seria lido como 40% do dinheiro, e não é.
 */
export type Metrica = "cost" | "tokens";

export function metricaDa(total: UsageBucket): Metrica {
  return total.cost > 0 ? "cost" : "tokens";
}

/** O peso de um recorte (ou de uma conversa) na unidade da página. */
export function valorNa(
  b: { cost: number | null; tokensIn: number; tokensOut: number },
  m: Metrica
): number {
  return m === "cost" ? (b.cost ?? 0) : b.tokensIn + b.tokensOut;
}

/**
 * Como se diz o preço de um recorte.
 *
 * Zero não é uma coisa só: modelo GRÁTIS (local, `:free`) custou zero de
 * verdade; modelo SEM PREÇO público pode ter custado qualquer coisa. Os dois
 * como "$0.00" diriam que o segundo saiu de graça.
 */
export type Preco = "pago" | "gratis" | "sem-preco";

export function precoDo(b: UsageBucket): Preco {
  if (b.cost > 0) return "pago";
  return b.hasUnknownCost ? "sem-preco" : "gratis";
}

/**
 * Uma FATIA do total — um modelo, um provider, um modo —, já medida. É a linha
 * do "By model" e a do relatório de uma dimensão inteira (o "See all").
 */
export interface Fatia {
  id: string;
  chats: number;
  tokens: number;
  cost: number;
  preco: Preco;
  /** Pago, mas com conversa sem preço dentro: o valor é um PISO (o "+"). */
  piso: boolean;
  /** A fatia do total, 0–100, na unidade da página. Nunca 0 pra quem pesou
   *  alguma coisa: um anel vazio e "0%" diriam que o modelo não custou nada. */
  pct: number;
  /** A fatia arredondaria pra zero — o rótulo diz "<1%". */
  quase: boolean;
}

/** O nome antigo, de quando só havia a linha de modelo. */
export type ModeloNaPagina = Fatia;

export function modelosDaPagina(agg: UsageAggregate): Fatia[] {
  return fatiasDe(agg.byModel, agg.total);
}

/**
 * O relatório de uma dimensão INTEIRA — o "See all" de Provider, Model ou
 * Mode. É relatório, não seletor: as mesmas linhas do "By model", com o anel
 * e os números, e nenhuma cara de coisa que se toca.
 *
 * Toda opção da dimensão entra, pra lista bater com o "See all N": as que
 * tiveram conversa no recorte, medidas e em ordem de peso; as que não
 * tiveram, no fim, PARADAS — "usei esse modelo, só não nesse período" também
 * é informação de relatório.
 */
export function relatorioDe(
  ops: readonly Opcao[],
  buckets: Record<string, UsageBucket>,
  total: UsageBucket
): { usadas: Fatia[]; paradas: Opcao[] } {
  const ids = new Set(ops.map((o) => o.id));
  const usadas = fatiasDe(
    Object.fromEntries(
      Object.entries(buckets).filter(([id, b]) => ids.has(id) && b.chats > 0)
    ),
    total
  );
  const medidas = new Set(usadas.map((u) => u.id));
  return { usadas, paradas: ops.filter((o) => !medidas.has(o.id)) };
}

/**
 * O recorte do relatório de uma dimensão: o da página, MENOS o filtro da
 * própria dimensão. Com "GPT 5" marcado, o relatório de modelos com o recorte
 * inteiro teria uma linha só, e os outros apareceriam como parados — quando
 * eles só estão fora do filtro. O período e as outras dimensões continuam
 * valendo: é o relatório DESTA página.
 */
export function semADimensao(
  f: UsageFilter,
  dim: "providers" | "models" | "modes"
): UsageFilter {
  return { ...f, [dim]: [] };
}

/** As fatias de um agrupamento qualquer, do maior peso pro menor. */
export function fatiasDe(
  buckets: Record<string, UsageBucket>,
  totalDoRecorte: UsageBucket
): Fatia[] {
  const m = metricaDa(totalDoRecorte);
  const total = valorNa(totalDoRecorte, m);
  return (
    Object.entries(buckets)
      .map(([id, b]) => {
        const peso = valorNa(b, m);
        const exato = total > 0 ? (peso / total) * 100 : 0;
        const quase = peso > 0 && Math.round(exato) === 0;
        return {
          id,
          chats: b.chats,
          tokens: b.tokensIn + b.tokensOut,
          cost: b.cost,
          preco: precoDo(b),
          piso: b.cost > 0 && b.hasUnknownCost,
          pct: quase ? 1 : Math.round(exato),
          quase,
          peso,
        };
      })
      // Empate (dois modelos grátis, por exemplo) resolve por volume e depois
      // pelo nome: lista que troca de ordem sozinha parece defeito.
      .sort(
        (a, b) => b.peso - a.peso || b.tokens - a.tokens || a.id.localeCompare(b.id)
      )
      .map(({ peso: _peso, ...linha }) => linha)
  );
}

/**
 * As conversas que sobem pro topo — as mais CARAS quando há dinheiro, as
 * MAIORES quando não. Sem dinheiro nenhum, "mais caras" seria uma lista em
 * ordem de nada: todas empatadas em zero.
 */
export function conversasDoTopo(agg: UsageAggregate, n: number): ChatUsageRow[] {
  if (metricaDa(agg.total) === "cost") return agg.chats.slice(0, n);
  return [...agg.chats]
    .sort(
      (a, b) =>
        b.tokensIn + b.tokensOut - (a.tokensIn + a.tokensOut) ||
        a.id.localeCompare(b.id)
    )
    .slice(0, n);
}

/** Quanto custa (ou quanto pesa) uma conversa, em média. `null` sem conversa. */
export function mediaPorConversa(total: UsageBucket): number | null {
  if (total.chats <= 0) return null;
  return valorNa(total, metricaDa(total)) / total.chats;
}

const MESES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-09-11" → "Sep 11" (ou "Sep 11, 2025", quando o ano precisa ser dito). */
function dia(iso: string, comAno: boolean): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  const s = `${MESES[m - 1]} ${d}`;
  return comAno ? `${s}, ${a}` : s;
}

/**
 * O que o recorte cobre DE FATO: da primeira à última conversa dentro dele.
 *
 * O seletor diz a janela que se pediu ("All time", "90 days"); isto diz onde
 * as conversas caíram. "All time" sozinho não diz se isso é um mês ou dois
 * anos — e é essa a régua de quem lê o total.
 *
 * O ano só aparece quando o recorte atravessa uma virada: dito sempre, ele
 * seria ruído em toda linha.
 */
export function faixaDeDatas(
  inicio: string | null,
  fim: string | null
): string {
  if (!inicio || !fim) return "";
  if (inicio === fim) return dia(inicio, false);
  const viraAno = inicio.slice(0, 4) !== fim.slice(0, 4);
  return `${dia(inicio, viraAno)} – ${dia(fim, false)}`;
}

/** Quantos valores estão marcados nos filtros de lista (o período não conta:
 *  ele tem o seletor dele, lá em cima). */
export function marcados(f: UsageFilter): number {
  return f.providers.length + f.models.length + f.modes.length;
}

/** Quantas opções de cada filtro ficam à vista na página. */
export const A_VISTA = 3;

/**
 * As pílulas que a fileira mostra: as TRÊS mais usadas, sempre — e as
 * marcadas que não estão entre elas.
 *
 * Marcada fora das três acontece sem ninguém pedir: a ordem é por número de
 * conversas, e ela muda sozinha quando uma conversa nova é gravada com a
 * página aberta. Um filtro ligado que some da página é um filtro esquecido —
 * o total muda e nada na tela diz por quê.
 *
 * E ela fica NA FRENTE. No fim da fileira ela caía depois das três, cortada
 * na beirada da tela: justamente o filtro ligado era a pílula que não dava
 * pra ver. As três não saem do lugar entre si.
 */
export function opcoesAVista(
  ops: readonly Opcao[],
  selecionados: readonly string[],
  n: number = A_VISTA
): Opcao[] {
  const fora = ops.filter((o, i) => i >= n && selecionados.includes(o.id));
  return [...fora, ...ops.slice(0, n)];
}

/**
 * A busca da lista inteira: pelo nome que a pessoa VÊ ("Sonnet 4.6") e pelo
 * id ("claude-sonnet-4-6") — quem digita pode ter qualquer um dos dois na
 * cabeça.
 */
export function buscarOpcoes(
  ops: readonly Opcao[],
  termo: string,
  nome: (id: string) => string
): Opcao[] {
  const t = termo.trim().toLowerCase();
  if (!t) return [...ops];
  return ops.filter(
    (o) => nome(o.id).toLowerCase().includes(t) || o.id.toLowerCase().includes(t)
  );
}

/**
 * Vale mostrar esta dimensão?
 *
 * Com UMA opção só, o filtro não filtra: marcá-la deixa tudo como está. Ela
 * só fica se estiver marcada — senão não haveria como desmarcar.
 */
export function valeFiltrar(ops: readonly Opcao[], selecionados: readonly string[]): boolean {
  return ops.length > 1 || selecionados.length > 0;
}
