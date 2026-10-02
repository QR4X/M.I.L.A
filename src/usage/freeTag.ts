// src/usage/freeTag.ts
// A etiqueta "free" de um modelo — o que a lista de modelos mostra ao lado do
// nome, e o que ela SIGNIFICA em cada caso.
//
// Havia um só rótulo pra duas coisas muito diferentes:
//
//   - de graça SEMPRE (um `:free` do OpenRouter, um modelo local do Ollama):
//     não existe fatura, ponto;
//   - de graça ATÉ UM LIMITE, e só se você tiver ligado o data-sharing no
//     painel da OpenAI (Data controls): passou da cota do dia, é cobrado
//     normal.
//
// Chamar as duas de "free" faz a segunda parecer a primeira — e a conta chega.
// Aqui elas viram etiquetas diferentes, e a da OpenAI carrega o NÚMERO, que é
// a única parte que interessa: 250k/dia não é o mesmo que 2,5M/dia.
//
// A cota depende do tier da conta (1–2 vs 3–5), então a etiqueta é montada com
// as settings da pessoa, e não com uma tabela fixa.

import { openaiFreeAllowance, openaiFreeTierForModel } from "./freeTokens";

export interface FreeTag {
  /** `always` = sem fatura. `daily` = cota diária já valendo. `offer` = a cota
   *  existe mas está desligada (data-sharing off) — é uma oferta, não um fato. */
  kind: "always" | "daily" | "offer";
  /** Tokens/dia da cota (só em `daily` e `offer`). */
  perDay?: number;
  /** O que aparece na etiqueta. */
  label: string;
  /** A frase inteira, pro title/tooltip. */
  detail: string;
}

/** 250000 → "250k"; 2500000 → "2.5M". O número é o recado; o resto é ruído. */
export function compactTokens(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m : m.toFixed(1)}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

/**
 * O modelo é grátis DE VERDADE?
 *
 * Quando o fetch trouxe a lista do provider — pelo preço zero no OpenRouter,
 * pela marca "Free Endpoint" do catálogo da NVIDIA no NIM —, ela é a verdade,
 * e o nome não conta: o OpenRouter tem grátis sem `:free` no id, e no NIM
 * 61 dos 81 modelos da API NÃO são do tier grátis, embora nada no id diga.
 * Sem lista (ninguém buscou ainda), vale o palpite do motor. O "_" do
 * catálogo da NVIDIA é o "." da API — os dois lados são comparados assim.
 */
export function gratisDeVerdade(
  model: string,
  livres: readonly string[] | undefined,
  palpite: boolean
): boolean {
  if (!livres || livres.length === 0) return palpite;
  const igual = (s: string) => s.toLowerCase().replace(/_/g, ".");
  const alvo = igual(model);
  return livres.some((l) => igual(l) === alvo);
}

/** 1000 → "1,000": o número da cota é o recado, e lido de relance. */
function milhar(n: number): string {
  return n.toLocaleString("en-US");
}

export function freeTag(
  provider: string,
  model: string,
  opts: {
    /** O modelo é grátis de verdade (ver gratisDeVerdade). */
    free: boolean;
    /** Data-sharing ligado no painel da OpenAI. */
    dataSharing: boolean;
    /** Usage tier da conta OpenAI (1–5). */
    tier: number;
    /** A cota diária dos grátis na chave (OpenRouter), quando o fetch soube. */
    cota?: { limit: number; remaining?: number };
  }
): FreeTag | null {
  const pool = provider === "openai" ? openaiFreeTierForModel(model) : null;
  if (pool) {
    // O tier decide a cota; sem data-sharing a conta é a do tier mesmo assim,
    // porque o que a etiqueta diz então é "é isto que você GANHARIA".
    const allow = openaiFreeAllowance(Math.max(opts.tier, 1), true);
    const perDay = pool === "mini" ? allow.miniPerDay : allow.bigPerDay;
    const qtd = compactTokens(perDay);
    if (opts.dataSharing) {
      return {
        kind: "daily",
        perDay,
        label: `${qtd}/day`,
        detail: `${qtd} tokens a day at no cost while you share API data with OpenAI. Past that, this model is billed normally — and the quota counts ALL your OpenAI API use, not just this vault.`,
      };
    }
    // O "+" é o que separa a oferta do fato: ele lê como "isto você GANHARIA".
    // Sem ele, a etiqueta de quem não ligou o programa fica igual à de quem
    // ligou — e a fatura desmente a tela no fim do mês.
    return {
      kind: "offer",
      perDay,
      label: `+${qtd}/day`,
      detail: `Turn on data sharing in OpenAI's Data controls to get ${qtd} tokens a day here at no cost.`,
    };
  }

  if (!opts.free) return null;
  // Grátis, mas cada casa com a sua regra — e a regra é o que deixa claro o
  // que "free" quer dizer ali.
  if (provider === "openrouter") {
    const c = opts.cota;
    const dia = c
      ? c.limit >= 1000
        ? `and ${milhar(c.limit)} a day on this key`
        : `and ${milhar(c.limit)} a day on this key — 1,000 once you've bought $10 in credits`
      : "and 50 a day (1,000 once you've bought $10 in credits)";
    const resta = c?.remaining != null ? ` ${milhar(c.remaining)} were left when you fetched.` : "";
    return {
      kind: "always",
      label: c ? `free · ${milhar(c.limit)}/day` : "free",
      detail: `No cost. OpenRouter's free models share 20 requests a minute ${dia}.${resta} A free variant can run on a different host, with a smaller context than the paid one.`,
    };
  }
  if (provider === "nim") {
    return {
      kind: "always",
      label: "free · 40/min",
      detail:
        "A Free Endpoint in NVIDIA's API catalog: no cost with your developer key, for development and testing, up to 40 requests a minute. Models without this mark aren't part of the free tier.",
    };
  }
  if (provider === "ollama") {
    return {
      kind: "always",
      label: "free",
      detail: "Runs on your own machine — there's no bill at all.",
    };
  }
  return {
    kind: "always",
    label: "free",
    detail: "No cost — this model has no billing at all.",
  };
}
