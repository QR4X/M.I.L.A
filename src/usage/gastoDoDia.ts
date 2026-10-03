// src/usage/gastoDoDia.ts
// O GASTO do dia em dinheiro — pro limite diário (o aviso a 80% e 100%, e o
// "parar os modelos pagos no limite") e pro cartão "Paid models" do Left today.
//
// Sai do livro do dia (livroDoDia.ts): tokens por modelo, hora a hora, vezes
// o preço público de cada um (pricing.ts). Daí os três cuidados:
//   · o dia é o de QUEM USA (a meia-noite local), não o de provider nenhum —
//     orçamento é coisa da pessoa;
//   · modelo sem preço público não entra na soma, e a conta diz quantos
//     pedidos ficaram de fora (a tela não promete um total que não tem);
//   · o Gemini entra pelo preço PAGO: num projeto sem billing ele não custa
//     nada, mas o plugin não tem como saber — e num orçamento, contar a mais
//     é o erro seguro.

import { getPricing } from "./pricing";
import { getAllEmbeddingModels } from "../rag/types";
import { horaDe, inicioDoDia, type LivroDoDia } from "./livroDoDia";

/** USD por 1M tokens de entrada e de saída. */
export interface Preco {
  entrada: number;
  saida: number;
}

/**
 * O preço público de um modelo, ou null quando ninguém sabe. Ollama é local
 * (zero); embedding sem preço de chat cai no preço de catálogo do RAG.
 */
export function precoConhecido(provider: string, model: string): Preco | null {
  if (provider === "ollama") return { entrada: 0, saida: 0 };
  const p = getPricing(provider, model);
  if (p.inputPerMillion != null && p.outputPerMillion != null) {
    return { entrada: p.inputPerMillion, saida: p.outputPerMillion };
  }
  const emb = getAllEmbeddingModels().find((m) => m.model === model && !m.discovered);
  if (emb) return { entrada: emb.pricePerMillion, saida: 0 };
  return null;
}

/** Custa dinheiro? (preço conhecido e acima de zero) */
export function ehPago(provider: string, model: string): boolean {
  const p = precoConhecido(provider, model);
  return !!p && (p.entrada > 0 || p.saida > 0);
}

export interface Gasto {
  /** USD gastos (só o que tem preço). */
  total: number;
  /** Pedidos em modelos sem preço público — fora da soma. */
  semPreco: number;
}

/** O gasto do livro desde `inicio`. */
export function gastoDesde(
  livro: LivroDoDia,
  inicio: Date,
  preco: (provider: string, model: string) => Preco | null = precoConhecido
): Gasto {
  const desde = horaDe(inicio);
  let total = 0;
  let semPreco = 0;
  for (const [hora, modelos] of Object.entries(livro)) {
    if (hora < desde) continue;
    for (const [chave, l] of Object.entries(modelos)) {
      const corte = chave.indexOf("\u0001");
      const p = preco(chave.slice(0, corte), chave.slice(corte + 1));
      if (!p) {
        semPreco += l.r;
        continue;
      }
      total += (l.i / 1_000_000) * p.entrada + (l.o / 1_000_000) * p.saida;
    }
  }
  return { total, semPreco };
}

function fusoDaMaquina(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** O gasto de HOJE, no dia de quem usa. */
export function gastoDeHoje(livro: LivroDoDia, agora: Date, fuso = fusoDaMaquina()): Gasto {
  return gastoDesde(livro, inicioDoDia(agora, fuso));
}

/** Os marcos do limite (80% e 100%) que este gasto ACABOU de cruzar. */
export function marcosCruzados(antes: number, depois: number, limite: number): Array<80 | 100> {
  if (!(limite > 0)) return [];
  const marcos: Array<80 | 100> = [];
  for (const m of [80, 100] as const) {
    const linha = (limite * m) / 100;
    if (antes < linha && depois >= linha) marcos.push(m);
  }
  return marcos;
}

/** Dinheiro de orçamento: centavos ("$1.62"); abaixo de um, "<$0.01". */
export function usd(n: number): string {
  if (n === 0) return "$0.00";
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}
