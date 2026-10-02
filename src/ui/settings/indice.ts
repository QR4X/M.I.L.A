// src/ui/settings/indice.ts
// As duas escolhas do ÍNDICE do Vault Q&A que voltaram pra tela (sumiram no
// redesign da 0.4.0; o motor continuou lendo): o peso dos vetores e a busca
// em pedaços. Sem DOM — a árvore das settings importa daqui.

import type { PickItem } from "./tree";

/** Os 4 perfis de rag/quant.ts, do mais fiel ao mais leve. */
export const QUANT_ITENS: PickItem[] = [
  { value: "precision", label: "Precision — full detail", icon: "target" },
  { value: "balanced", label: "Balanced — 4× smaller", icon: "scale" },
  { value: "light", label: "Light — smaller vectors", icon: "feather" },
  { value: "minimal", label: "Minimal — smallest", icon: "minimize-2" },
];

/** O que o índice carregado tem hoje — o que a busca está usando agora. */
export interface IndiceAtual {
  profile: string;
  streamed: boolean;
}

/**
 * O que falta pro índice refletir as settings — ou null quando já reflete.
 * As duas mudanças só valem na PRÓXIMA atualização (que recomeça do zero), e
 * sem este aviso a pessoa trocaria a opção e continuaria buscando no índice
 * velho, achando que nada mudou.
 */
export function pendenciaDoIndice(
  atual: IndiceAtual | null,
  s: { ragQuantProfile?: string; ragStreamShards?: boolean }
): string | null {
  if (!atual) return null;
  const partes: string[] = [];
  if ((s.ragQuantProfile || "balanced") !== (atual.profile || "balanced")) {
    partes.push("the new precision");
  }
  const pedacos = s.ragStreamShards === true;
  if (pedacos !== atual.streamed) {
    partes.push(pedacos ? "search in pieces" : "a single index file");
  }
  return partes.length > 0
    ? `Update the index to apply ${partes.join(" and ")}.`
    : null;
}
