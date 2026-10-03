// src/i18n/chave.ts
// A chave CURTA de um texto da interface: FNV-1a de 32 bits em base 36 (até 7
// caracteres). No build de produção o dicionário pt-BR troca cada chave em
// inglês por ela (ver esbuild.config.mjs › dicionarioCurto): a frase em
// inglês já está no código, no tr("…") que a mostra, e repeti-la como chave
// do dicionário era ~30 KB de texto em dobro no main.js.
//
// A MESMA conta mora em scripts/chaveCurta.mjs, que o build usa; o teste
// tests/i18nChaveCurta.test.ts garante que as duas dão o mesmo resultado.

export function chaveCurta(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
