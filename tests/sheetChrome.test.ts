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
