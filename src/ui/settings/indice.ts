// src/ui/settings/indice.ts
// As duas escolhas do ÍNDICE do Vault Q&A que voltaram pra tela (sumiram no
// redesign da 0.4.0; o motor continuou lendo): o peso dos vetores e a busca
// em pedaços. Sem DOM — a árvore das settings importa daqui.

import type { PickItem } from "./tree";
import { marca, tr } from "../../i18n/tr";

/** Os 4 perfis de rag/quant.ts, do mais fiel ao mais leve. O rótulo é só
 *  MARCADO (marca): a árvore traduz ao montar o menu. */
export const QUANT_ITENS: PickItem[] = [
  { value: "precision", label: marca("Precision — full detail"), icon: "target" },
  { value: "balanced", label: marca("Balanced — 4× smaller"), icon: "scale" },
  { value: "light", label: marca("Light — smaller vectors"), icon: "feather" },
  { value: "minimal", label: marca("Minimal — smallest"), icon: "minimize-2" },
];

/** O que o índice carregado tem hoje — o que a busca está usando agora. */
export interface IndiceAtual {
  profile: string;
  streamed: boolean;
  /** O modelo de embedding com que os vetores foram feitos. */
  model?: string;
}

/**
 * O que falta pro índice refletir as settings — ou null quando já reflete.
 * As duas mudanças só valem na PRÓXIMA atualização (que recomeça do zero), e
 * sem este aviso a pessoa trocaria a opção e continuaria buscando no índice
 * velho, achando que nada mudou.
 */
export function pendenciaDoIndice(
  atual: IndiceAtual | null,
  s: { ragQuantProfile?: string; ragStreamShards?: boolean; ragEmbeddingModel?: string }
): string | null {
  if (!atual) return null;
  const partes: string[] = [];
  // Vetores de um modelo não conversam com os de outro: trocar o modelo só
  // vale quando o índice é refeito com ele.
  if (s.ragEmbeddingModel && atual.model && s.ragEmbeddingModel !== atual.model) {
    partes.push(tr("the new embedding model"));
  }
  if ((s.ragQuantProfile || "balanced") !== (atual.profile || "balanced")) {
    partes.push(tr("the new precision"));
  }
  const pedacos = s.ragStreamShards === true;
  if (pedacos !== atual.streamed) {
    partes.push(pedacos ? tr("search in pieces") : tr("a single index file"));
  }
  if (partes.length === 0) return null;
  // "A and B and C": cada pedaço traduzido, e o "and" também.
  const quais = partes.reduce((a, b) => tr("{a} and {b}", { a, b }));
  return tr("Update the index to apply {changes}.", { changes: quais });
}
