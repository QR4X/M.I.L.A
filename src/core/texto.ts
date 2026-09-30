// src/core/texto.ts
// Texto de um valor que veio DE FORA: frontmatter de nota, argumentos que o
// LLM montou, resultado de FileReader.
//
// `String(v)` resolve o caso comum e falha no caso torto: um `title:` que o
// usuário escreveu como mapa no YAML, ou um argumento que o modelo mandou como
// objeto, viram a string "[object Object]" — e isso ia pra tela. No diálogo de
// confirmação do agente, pior ainda: o usuário aprovaria uma escrita sem ver o
// conteúdo dela.
//
// Aqui só primitivo virá texto. Objeto, array, função e símbolo caem no padrão.

/**
 * Converte pra string apenas o que faz sentido como texto. Qualquer outra
 * coisa (incluindo null e undefined) devolve `padrao`.
 *
 * String vazia é preservada: `texto("")` é `""`, não o padrão — quem quer o
 * padrão no vazio escreve `texto(v) || padrao`.
 */
export function texto(v: unknown, padrao = ""): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : padrao;
  if (typeof v === "boolean" || typeof v === "bigint") return String(v);
  return padrao;
}
