// src/core/tokens.ts
// A estimativa de tokens do app — UMA fórmula só.
//
// Mora aqui, num módulo sem dependência nenhuma, porque quem precisa dela vai
// do indexador do RAG (que conta o que embedou) ao cartão de projeto (que
// mostra quantos tokens de entrada o projeto custa ao abrir uma conversa). Se
// cada um tivesse a sua, os números das duas telas contariam a mesma nota de
// jeitos diferentes.

/** Estimativa rude de tokens (1 token ≈ 4 chars no inglês, 3-3.5 em PT-BR). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
