import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// O balão do ⋯ também abre FORA da `.axxa-root` — nas settings, que são um
// modal do Obsidian. Pra isso o CSS dele começa pela camada, e a camada traz
// os tokens que só a raiz define.

const CSS = readFileSync(resolve(__dirname, "../styles/main.css"), "utf8");
const SEM_COMENTARIO = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** O corpo da primeira regra cujo seletor é EXATAMENTE `seletor` — começando
 *  a regra, não no fim de um seletor descendente (`body.x .axxa-root {`). */
function bloco(seletor: string): string {
  const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = SEM_COMENTARIO.match(new RegExp(`(?:^|\\})\\s*${escapado}\\s*\\{([^}]*)\\}`, "m"));
  expect(m, `regra sumiu: ${seletor}`).toBeTruthy();
  return m![1];
}

const token = (corpo: string, nome: string) =>
  corpo.match(new RegExp(`${nome}:\\s*([^;]+);`))?.[1].trim();

describe("o balão não depende da raiz", () => {
  it("nenhuma regra do balão começa por .axxa-root", () => {
    expect(SEM_COMENTARIO).not.toMatch(/\.axxa-root\s+(button)?\.axxa-pop/);
  });

  it("a camada traz os tokens da raiz, com os MESMOS valores", () => {
    const raiz = bloco(".axxa-root");
    const camada = bloco(".axxa-pop-layer");
    for (const nome of ["--axxa-1", "--axxa-2", "--axxa-3", "--axxa-s1", "--axxa-hairline"]) {
      expect(token(camada, nome), nome).toBeTruthy();
      expect(token(camada, nome), nome).toBe(token(raiz, nome));
    }
  });

  it("solta (fora da raiz), a camada tem a tela como referência", () => {
    expect(bloco(".axxa-pop-layer.is-loose")).toMatch(/position:\s*fixed/);
  });

  it("o balão de escolha é a continuação do botão: rola, e sem largura própria", () => {
    const corpo = bloco(".axxa-pop-layer .axxa-pop.is-pick");
    expect(corpo).toMatch(/overflow-y:\s*auto/);
    // a largura é a do botão (o JS põe); nada de teto próprio que a desfaça
    expect(corpo).toMatch(/max-width:\s*none/);
    expect(corpo).toMatch(/background-color:\s*var\(--dropdown-background\)/);
  });

  it("aberto, botão e lista fecham um cartão só (o canto do encontro fica reto)", () => {
    expect(bloco(".axxa-pop-layer .axxa-pop.is-pick.is-down")).toMatch(/border-top-left-radius:\s*0/);
    expect(bloco(".axxa-pop-layer .axxa-pop.is-pick.is-up")).toMatch(/border-bottom-left-radius:\s*0/);
    expect(bloco(".axxa-settings-root button.axxa-pick.is-open-down")).toMatch(
      /border-radius:\s*var\(--axxa-r\) var\(--axxa-r\) 0 0/
    );
    expect(bloco(".axxa-settings-root button.axxa-pick.is-open-up")).toMatch(
      /border-radius:\s*0 0 var\(--axxa-r\) var\(--axxa-r\)/
    );
  });

  it("as linhas da lista têm as colunas do botão", () => {
    const linha = bloco(".axxa-pop-layer .axxa-pop.is-pick button.axxa-pop-item");
    const botao = bloco(".axxa-settings-root .setting-item-control button.axxa-pick");
    const pad = (c: string) => c.match(/padding:\s*([^;]+);/)?.[1].trim();
    expect(pad(linha)).toBe(pad(botao));
    expect(linha).toMatch(/gap:\s*var\(--size-4-2\)/);
    expect(botao).toMatch(/gap:\s*var\(--size-4-2\)/);
    expect(linha).toMatch(/min-height:\s*var\(--input-height\)/);
  });
});

describe("o menu.ts decide onde o balão mora pelo BOTÃO", () => {
  const MENU = readFileSync(resolve(__dirname, "../src/ui/menu.ts"), "utf8");

  it("procura a raiz a partir da âncora, não no documento inteiro", () => {
    // `doc.querySelector(".axxa-root")` acharia o painel do chat ATRÁS do
    // modal das settings — o balão abriria escondido.
    expect(MENU).toMatch(/ancoraEl\.closest<HTMLElement>\("\.axxa-root"\)/);
  });

  it("fora da raiz, mora no modal (some junto com ele) ou no body", () => {
    expect(MENU).toMatch(/closest<HTMLElement>\("\.modal-container"\)/);
    expect(MENU).toContain('"axxa-pop-layer is-loose"');
  });
});
