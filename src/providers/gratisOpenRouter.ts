// src/providers/gratisOpenRouter.ts
// O que é GRÁTIS de verdade no catálogo do OpenRouter — a regra num lugar só,
// sem DOM nem rede: o provider (listFreeModels) e o cache do catálogo
// (modelInfoStore) leem daqui, e os dois concordam.

/** Uma entrada do catálogo, só com o que a regra lê. */
export interface EntradaOpenRouter {
  id: string;
  pricing?: Record<string, unknown>;
  architecture?: { output_modalities?: unknown };
  description?: unknown;
}

/**
 * O preço zera nos dois lados?
 *
 * O catálogo manda os valores como STRING ("0", "0.0000001"), então comparar
 * com 0 direto falha em silêncio — `"0" == 0` é true por coerção, mas
 * `"0.0000001"` também vira um número que ninguém compara certo sem converter.
 * E um modelo grátis de entrada e pago na saída não é grátis: os dois contam.
 */
export function ehPrecoZero(pricing: unknown): boolean {
  const p = pricing as Record<string, unknown> | undefined;
  if (!p) return false;
  const zero = (v: unknown) => {
    if (typeof v !== "string" && typeof v !== "number") return false;
    const n = Number(v);
    return Number.isFinite(n) && n === 0;
  };
  return zero(p.prompt) && zero(p.completion);
}

/**
 * Grátis DE VERDADE no OpenRouter.
 *
 * A variante `:free` é a grátis declarada, e vale. Sem o sufixo, preço zero
 * não basta: modelo que gera áudio ou imagem cobra por ITEM — o Lyria do
 * Google custa US$ 0,04 por clipe e US$ 0,08 por música —, um preço que o
 * catálogo não põe em campo nenhum (prompt e completion vêm "0", até nos
 * detalhes do endpoint); ele só aparece na descrição. Então, sem sufixo, só
 * conta quando TODO preço é zero, a saída é só texto e a descrição não cita
 * preço.
 */
export function ehGratisNoOpenRouter(m: EntradaOpenRouter): boolean {
  if (m.id.toLowerCase().endsWith(":free")) return true;
  if (!ehPrecoZero(m.pricing)) return false;
  const precos = Object.values(m.pricing ?? {}).filter(
    (v) => typeof v === "string" || typeof v === "number"
  );
  if (!precos.every((v) => Number(v) === 0)) return false;
  const saida = m.architecture?.output_modalities;
  const soTexto = !Array.isArray(saida) || saida.every((s) => s === "text");
  const citaPreco = typeof m.description === "string" && /\$\s?\d/.test(m.description);
  return soTexto && !citaPreco;
}
