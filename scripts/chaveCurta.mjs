// scripts/chaveCurta.mjs
// A chave curta do dicionário pt-BR, do lado do BUILD — a mesma conta de
// src/i18n/chave.ts (o teste tests/i18nChaveCurta.test.ts confere que batem).
// E a transformação que o esbuild aplica em cada parte do dicionário: as
// chaves em inglês viram a chave curta; o português fica como está.

import esbuild from "esbuild";

/** FNV-1a de 32 bits em base 36 (igual a src/i18n/chave.ts). */
export function chaveCurta(texto) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Lê uma parte do dicionário (um .ts que só exporta um objeto literal) e
 * devolve o código JS da mesma parte com as chaves curtas. `vistas` guarda,
 * entre as partes, qual texto deu cada chave curta: dois textos DIFERENTES
 * com a mesma chave quebrariam a tradução em silêncio, e aí o build para.
 */
export async function parteCurta(ts, arquivo, vistas = new Map()) {
  const js = (await esbuild.transform(ts, { loader: "ts", format: "cjs" })).code;
  const mod = { exports: {} };
  new Function("module", "exports", js)(mod, mod.exports);
  const exportados = Object.entries(mod.exports);
  if (exportados.length !== 1) {
    throw new Error(`${arquivo}: a parte do dicionário tem que exportar UM objeto (achei ${exportados.length})`);
  }
  const [nome, dicionario] = exportados[0];
  const curto = {};
  for (const [texto, traducao] of Object.entries(dicionario)) {
    const chave = chaveCurta(texto);
    const antes = vistas.get(chave);
    if (antes !== undefined && antes !== texto) {
      throw new Error(`${arquivo}: "${texto}" e "${antes}" dão a mesma chave curta (${chave})`);
    }
    vistas.set(chave, texto);
    curto[chave] = traducao;
  }
  return { nome, curto, codigo: `export const ${nome} = ${JSON.stringify(curto)};\n` };
}
