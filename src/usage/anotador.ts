// src/usage/anotador.ts
// O FIO entre quem gasta e o livro do dia (ver livroDoDia.ts): os providers
// (o chat, em providers/index.ts) e os embeddings (rag/embeddings.ts) avisam
// aqui cada pedido aceito, e o plugin — que é quem tem o livro e grava —
// recebe. Módulo à parte pra nenhum dos dois lados importar o outro: o rag
// importando o registro de providers, ou o contrário, vira import circular.

import type { Lancamento } from "./livroDoDia";

export type Anotador = (provider: string, model: string, delta: Partial<Lancamento>) => void;

let atual: Anotador | null = null;

/** O plugin liga o registro ao carregar (e desliga com null ao sair). */
export function definirAnotadorDeUso(fn: Anotador | null): void {
  atual = fn;
}

/** Soma um pedido (e/ou tokens) no livro — sem anotador ligado, nada. */
export function anotarUso(provider: string, model: string, delta: Partial<Lancamento>): void {
  atual?.(provider, model, delta);
}

/** Quem decide se um pedido pode sair (o limite de gasto do dia): lança pra
 *  barrar. O plugin liga ao carregar; sem guarda, tudo passa. */
export type GuardaDeGasto = (provider: string, model: string) => void;

let guarda: GuardaDeGasto | null = null;

export function definirGuardaDeGasto(fn: GuardaDeGasto | null): void {
  guarda = fn;
}

/** Antes de cada pedido de chat: passa, ou lança o motivo de não passar. */
export function conferirGasto(provider: string, model: string): void {
  guarda?.(provider, model);
}
