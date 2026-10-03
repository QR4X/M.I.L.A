import { describe, expect, it } from "vitest";
import { PT_CHAT } from "../src/i18n/ui-pt/chat";
import { PT_PLUGIN } from "../src/i18n/ui-pt/plugin";
import { PT_PROJETOS } from "../src/i18n/ui-pt/projetos";
import { PT_SETTINGS } from "../src/i18n/ui-pt/settings";
import { PT_SHELL } from "../src/i18n/ui-pt/shell";
import { PT_USAGE } from "../src/i18n/ui-pt/usage";

// O dicionário pt-BR é feito de partes (uma por área do app), juntas num
// objeto só — e numa junção, a parte que vem depois vence. Se duas partes
// traduzem a MESMA chave de jeitos diferentes, uma tela mostra a tradução da
// outra sem ninguém ver. Este teste exige que as repetidas concordem.

const PARTES: Record<string, Record<string, string>> = {
  shell: PT_SHELL,
  chat: PT_CHAT,
  usage: PT_USAGE,
  projetos: PT_PROJETOS,
  settings: PT_SETTINGS,
  plugin: PT_PLUGIN,
};

describe("o dicionário pt-BR concorda consigo mesmo", () => {
  it("a mesma chave em duas partes tem a mesma tradução", () => {
    const vistas = new Map<string, { parte: string; valor: string }>();
    const conflitos: string[] = [];
    for (const [parte, dic] of Object.entries(PARTES)) {
      for (const [chave, valor] of Object.entries(dic)) {
        const antes = vistas.get(chave);
        if (antes && antes.valor !== valor) {
          conflitos.push(`${JSON.stringify(chave)}: ${antes.parte}=${JSON.stringify(antes.valor)} × ${parte}=${JSON.stringify(valor)}`);
        } else if (!antes) {
          vistas.set(chave, { parte, valor });
        }
      }
    }
    expect(conflitos, conflitos.join("\n")).toEqual([]);
  });
});
