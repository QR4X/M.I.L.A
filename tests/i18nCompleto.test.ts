import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { PT_BR_UI } from "../src/i18n/ui-pt";
import { definirIdiomaDaInterface, marca, tr } from "../src/i18n/tr";
import { resolverIdioma } from "../src/i18n";

// A interface em pt-BR está COMPLETA: todo tr("…") e marca("…") do código tem
// tradução, com as mesmas {variáveis}. Pra conferir só alguns arquivos (quem
// está traduzindo uma parte), passe I18N_ARQUIVOS=src/ui/A.tsx,src/ui/B.ts.

const RAIZ = resolve(__dirname, "..");
const SRC = join(RAIZ, "src");

function arquivos(dir: string): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) {
      if (p === join(SRC, "i18n")) continue;
      out.push(...arquivos(p));
    } else if (/\.(ts|tsx)$/.test(nome)) out.push(p);
  }
  return out;
}

/** Desfaz os escapes de um literal JS simples. */
function semEscape(s: string): string {
  return s.replace(/\\(u\{?[0-9a-fA-F]+\}?|.)/g, (_m, c: string) => {
    if (c === "n") return "\n";
    if (c === "t") return "\t";
    if (c.startsWith("u")) return String.fromCodePoint(parseInt(c.replace(/[u{}]/g, ""), 16));
    return c;
  });
}

/** Os textos marcados num arquivo: o 1º argumento literal de tr() e marca(). */
export function chavesDe(codigo: string): string[] {
  const chaves: string[] = [];
  const re = /\b(?:tr|marca)\(\s*(["'`])((?:\\[\s\S]|(?!\1)[^\\])*)\1/g;
  for (const m of codigo.matchAll(re)) {
    if (m[1] === "`" && m[2].includes("${")) continue; // template com ${}: não é chave
    chaves.push(semEscape(m[2]));
  }
  return chaves;
}

const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

function alvo(): string[] {
  const filtro = process.env.I18N_ARQUIVOS;
  if (!filtro) return arquivos(SRC);
  return filtro.split(",").map((f) => resolve(RAIZ, f.trim()));
}

describe("a interface em pt-BR", () => {
  it("todo texto marcado tem tradução, com as mesmas {variáveis}", () => {
    const faltando: string[] = [];
    const variaveis: string[] = [];
    for (const f of alvo()) {
      const rel = relative(RAIZ, f).replace(/\\/g, "/");
      for (const chave of chavesDe(readFileSync(f, "utf8"))) {
        const pt = PT_BR_UI[chave];
        if (pt === undefined) faltando.push(`${rel}: ${JSON.stringify(chave)}`);
        else if (vars(pt).join(",") !== vars(chave).join(",")) {
          variaveis.push(`${rel}: ${JSON.stringify(chave)} → ${JSON.stringify(pt)}`);
        }
      }
    }
    expect(faltando, `sem tradução (${faltando.length}):\n${faltando.join("\n")}`).toEqual([]);
    expect(variaveis, `{variáveis} diferentes:\n${variaveis.join("\n")}`).toEqual([]);
  });

  it("nenhuma tradução vazia", () => {
    const vazias = Object.entries(PT_BR_UI).filter(([, v]) => !v.trim()).map(([k]) => k);
    expect(vazias).toEqual([]);
  });
});

describe("tr()", () => {
  it("em inglês devolve a chave; em pt-BR, a tradução; as {variáveis} se preenchem", () => {
    const chave = Object.keys(PT_BR_UI)[0];
    definirIdiomaDaInterface("en-us");
    expect(tr("Some text that has no translation {n}", { n: 3 })).toBe("Some text that has no translation 3");
    if (chave) {
      definirIdiomaDaInterface("pt-br");
      expect(tr(chave)).toBe(PT_BR_UI[chave]);
    }
    definirIdiomaDaInterface("pt-br");
    expect(tr("Texto sem tradução nenhuma")).toBe("Texto sem tradução nenhuma");
    expect(tr("{a} e {b}", { a: 1 })).toBe("1 e {b}"); // variável que não veio fica à vista
    definirIdiomaDaInterface("en-us");
    expect(marca("All time")).toBe("All time");
  });

  it("o 'auto' segue o Obsidian; o resto é o que a pessoa escolheu", () => {
    expect(resolverIdioma("auto")).toBe("en-us"); // o stub diz "en"
    expect(resolverIdioma("pt-br")).toBe("pt-br");
    expect(resolverIdioma("en-us")).toBe("en-us");
    expect(resolverIdioma("xx")).toBe("en-us");
  });

  it("a extração acha os três tipos de aspas e pula template com ${}", () => {
    expect(chavesDe(`tr("A") + tr('B', { n }) + marca(\`C\`) + tr(\`D \${x}\`) + str("E")`)).toEqual(["A", "B", "C"]);
    expect(chavesDe(`tr("Say \\"hi\\"")`)).toEqual(['Say "hi"']);
  });
});
