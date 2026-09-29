import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// A MOLDURA da folha no celular: a faixa da barra de gestos embaixo dela e o
// tamanho que ela assume quando o teclado fecha.

const CSS = readFileSync(resolve(__dirname, "../styles/main.css"), "utf8");
const SEM_COMENTARIO = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

/** O corpo (sem comentários) da primeira regra cujo seletor contém `agulha`. */
function bloco(agulha: string): string {
  const i = SEM_COMENTARIO.indexOf(agulha);
  expect(i, `seletor sumiu do CSS: ${agulha}`).toBeGreaterThan(-1);
  const abre = SEM_COMENTARIO.indexOf("{", i);
  const fecha = SEM_COMENTARIO.indexOf("}", abre);
  return SEM_COMENTARIO.slice(abre + 1, fecha);
}

describe("a faixa da barra de gestos tem a cor da folha", () => {
  // Com o teclado fechado, a folha termina em cima da reserva de baixo da
  // gaveta do Obsidian (`.workspace-drawer-inner`), pintada com a cor da
  // gaveta — um degrau mais escura que a folha. Aparecia como uma barra grudada
  // no fim dela.
  const faixa = () =>
    bloco(".workspace-drawer-inner:has(.axxa-root .axxa-sheet-layer.is-open)");

  it("a folha e a faixa usam o MESMO token de cor", () => {
    // Duas contas pra mesma cor é como se descobre, meses depois, que uma
    // delas foi ajustada e a outra não.
    expect(bloco(".axxa-root .axxa-sheet {")).toContain(
      "background-color: var(--axxa-sheet-bg)"
    );
    expect(faixa()).toContain("var(--axxa-sheet-bg)");
    expect(CSS).toMatch(/--axxa-sheet-bg:\s*color-mix\(/);
  });

  it("pinta SÓ a faixa de baixo — a de cima é da barra de status", () => {
    // A mesma caixa reserva também a área da barra de status, em cima. Um
    // `background-color` pintaria as duas; o gradiente de corte seco pinta só
    // a altura da reserva de baixo.
    expect(faixa()).not.toMatch(/background-color\s*:/);
    expect(faixa()).toMatch(/background-image:\s*linear-gradient\(\s*to top/);
    // A altura do corte é a MESMA conta que o Obsidian usa pra reservar.
    expect(faixa()).toContain(
      "max(var(--safe-area-inset-bottom), var(--size-4-4))"
    );
  });

  it("só enquanto há folha aberta", () => {
    expect(CSS).toContain(
      ".workspace-drawer-inner:has(.axxa-root .axxa-sheet-layer.is-open)"
    );
  });
});

describe("o tamanho FIT: a folha encolhe quando o teclado fecha", () => {
  it("do tamanho do conteúdo, com o teto do grande", () => {
    const b = bloco(".axxa-root .axxa-sheet.is-fit {");
    // `0` e não `auto`: do grande pra este a folha ENCOLHE, e de auto o
    // navegador não anima.
    expect(b).toContain("min-height: 0");
    expect(b).toContain("max-height: 94%");
    // O teto é o mesmo do grande — um formulário longo pode chegar lá.
    expect(bloco(".axxa-root .axxa-sheet.is-full {")).toContain("max-height: 94%");
  });
});

describe("os cartões de skill têm todos o mesmo tamanho", () => {
  // Qualquer que seja o prompt ou o nome. Uma galeria se lê pelo ritmo, e o
  // ritmo é o tamanho igual: cartões de alturas diferentes numa grade abrem
  // degraus, e a fileira seguinte começa torta.
  it("a prévia do prompt tem altura FIXA, não um intervalo", () => {
    const b = bloco(".axxa-root .axxa-tile-paper {");
    expect(b).toMatch(/(^|\s)height:\s*\d+px/);
    expect(b).not.toMatch(/min-height|max-height/);
  });

  it("as colunas são metades exatas — o conteúdo não estica nenhuma", () => {
    // `1fr` é `minmax(auto, 1fr)`: o nome, que é nowrap, esticava a coluna e o
    // cartão saía pela borda da tela.
    expect(bloco(".axxa-root .axxa-tiles {")).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr))"
    );
    expect(bloco(".axxa-root .axxa-tile-wrap {")).toContain("min-width: 0");
  });

  it("o cartão ocupa a célula inteira, e o nome corta em vez de quebrar", () => {
    expect(bloco(".axxa-root button.axxa-tile {")).toContain("height: 100%");
    const nome = bloco(".axxa-root .axxa-tile-head .axxa-tile-name {");
    expect(nome).toContain("white-space: nowrap");
    expect(nome).toContain("text-overflow: ellipsis");
  });
});

describe("contraste dentro das folhas — medido, e preso aqui", () => {
  // Medido no preview antes: data, dica, ⋯ e ícones do rodapé do cartão entre
  // 1,7:1 e 2,6:1; o ícone do projeto na própria plaquinha a 1,34:1; o
  // cartão sobre a folha a 1,2:1 — e, no tema claro, mais ESCURO que ela.

  it("informação em cima de um cartão é muted, nunca faint", () => {
    // `--text-faint` só é legível no fundo da página (a regra dos degraus, lá
    // nos tokens). Em cima de uma superfície levantada ele fica abaixo de 3:1.
    for (const sel of [
      ".axxa-root .axxa-proj-card-when {",
      ".axxa-root .axxa-proj-card-about.is-empty {",
      ".axxa-root .axxa-proj-card-stat .axxa-icon {",
      ".axxa-root button.axxa-proj-card-more {",
      ".axxa-root button.axxa-tile-more {",
      ".axxa-root .axxa-field-hint {",
    ]) {
      const b = bloco(sel);
      expect(b, sel).toContain("var(--text-muted)");
      expect(b, sel).not.toContain("var(--text-faint)");
    }
  });

  it("no tema claro, o cartão é o papel do tema — mais CLARO que a folha", () => {
    const claro = bloco("body.theme-light .axxa-root .axxa-sheet {");
    expect(claro).toContain("--axxa-s1: var(--background-primary)");
  });

  it("os degraus da folha saem só do tema — nenhuma cor escrita à mão", () => {
    // É o que deixa isto funcionar em qualquer tema do Obsidian: tudo é
    // mistura das variáveis dele. O bloco do escuro é achado pela declaração
    // (há mais de uma regra `.axxa-root .axxa-sheet`).
    const i = SEM_COMENTARIO.indexOf(
      "--axxa-s1: color-mix(in srgb, var(--text-normal) 12%"
    );
    expect(i, "o degrau do escuro dentro da folha sumiu").toBeGreaterThan(-1);
    const escuro = SEM_COMENTARIO.slice(
      SEM_COMENTARIO.lastIndexOf("{", i),
      SEM_COMENTARIO.indexOf("}", i)
    );
    const claro = bloco("body.theme-light .axxa-root .axxa-sheet {");
    for (const b of [escuro, claro]) {
      expect(b).toContain("--axxa-s1:");
      expect(b).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
    }
  });

  it("campos, grupos, prévia e busca usam a MESMA superfície dos cartões", () => {
    const b = bloco(".axxa-root .axxa-sheet .axxa-sheet-group,");
    expect(b).toContain("background-color: var(--axxa-s1)");
    for (const sel of [
      ".axxa-root .axxa-sheet .axxa-form-preview",
      ".axxa-root .axxa-sheet .axxa-input",
      ".axxa-root .axxa-sheet .axxa-textarea",
      ".axxa-root .axxa-sheet .axxa-search-field",
    ])
      expect(CSS).toContain(sel);
  });

  it("o ícone de um projeto se mistura com o texto do TEMA pra ler na placa", () => {
    // Mais claro no escuro, mais escuro no claro — sozinho, sem regra por tema.
    expect(bloco(".axxa-root .axxa-thing-mark svg {")).toMatch(
      /color-mix\(in srgb, currentColor \d+%, var\(--text-normal\)\)/
    );
  });

  it("o véu parte do véu do tema, só mais fundo", () => {
    const b = bloco(".axxa-root .axxa-scrim {");
    expect(b).toContain("var(--background-modifier-cover");
    expect(b).toContain("color-mix(");
  });
});
