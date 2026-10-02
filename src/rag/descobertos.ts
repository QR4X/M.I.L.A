// src/rag/descobertos.ts
// Modelos de embedding DESCOBERTOS na conta de cada provider (o "Fetch
// models" traz junto — ver plugin.scanEmbeddings). Eles somam ao catálogo de
// fábrica em rag/types.ts (getAllEmbeddingModels).

/** Os providers que o RAG usa como fonte de embedding. */
export const EMBEDDING_PROVIDERS: readonly string[] = [
  "openai",
  "openrouter",
  "gemini",
  "nim",
];

/** Soma os ids novos aos já salvos, sem repetir — os antigos ficam na frente:
 *  um modelo que sumiu do catálogo hoje pode ser o do índice de ontem. */
export function somarDescobertos(
  antes: readonly string[] | undefined,
  novos: readonly string[]
): string[] {
  return [...new Set([...(antes ?? []), ...novos])];
}
