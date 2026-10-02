// src/core/settingsLegado.ts
// Campos que o data.json ainda carrega de versões antigas e que nada mais lê.
//
// Eles vinham da casca antiga (até a 0.3.x), que tinha uma tela "Connections →
// Models" com um ★ por PAPEL (chat, imagem, vídeo, TTS, embedding) e um
// provider preferido pra quando o mesmo modelo existe em dois. A tela saiu no
// redesign da 0.4.0; os campos ficaram — semeados a cada carga e regravados a
// cada gravação, sem nenhum leitor. Lixo que parecia configuração.
//
// A revisão única do Ollama (core/ollamaPadrao.ts) ainda olha esses campos no
// data.json SALVO como sinal de uso — por isso a limpeza roda nas settings em
// memória, depois dela, e não no que veio do disco.

export const CAMPOS_MORTOS = ["roleModels", "modelProvider"] as const;

/** Tira das settings em memória o que nada lê. A próxima gravação já sai sem. */
export function limparCamposMortos(s: object): void {
  const r = s as Record<string, unknown>;
  for (const k of CAMPOS_MORTOS) delete r[k];
}
