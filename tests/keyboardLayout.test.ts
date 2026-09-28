import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// O TECLADO tem um listener só, e é o do composer.
//
// Este arquivo existe porque o mesmo bug voltou por seis releases seguidas, e
// sempre pelo mesmo caminho: alguém precisa que uma coisa fique acima do
// teclado, escreve uma conta nova pra ela, e a conta nova soma em cima de uma
// que já estava feita. O resultado é sempre um dos dois — ou a coisa fica
// atrás do teclado, ou ela salta 300px pro topo da tela.
//
// A regra do app é: quem publica a medida é o Obsidian (`--keyboard-height` no
// <html>), e quem a desconta é a GAVETA, uma vez só:
//
//     body.is-mobile .workspace-drawer.axxa-keyboard-open {
//       height: calc(100dvh - var(--keyboard-height, 0px)) !important;
//     }
//
// Tudo dentro dela — o composer, a folha, o painel da assistente — herda esse
// fim e não faz conta nenhuma. Quem precisar de uma exceção que a escreva aqui
// junto com o motivo; sem isso, este teste quebra.

const CSS = readFileSync(resolve(__dirname, "../styles/main.css"), "utf8");

/** O corpo da primeira regra cujo seletor contém `agulha`. */
function bloco(agulha: string): string {
  const i = CSS.indexOf(agulha);
  expect(i, `seletor sumiu do CSS: ${agulha}`).toBeGreaterThan(-1);
  const abre = CSS.indexOf("{", i);
  const fecha = CSS.indexOf("}", abre);
  return CSS.slice(abre + 1, fecha);
}

/**
 * Toda DECLARAÇÃO que menciona a altura do teclado, com a linha inteira.
 *
 * Os comentários saem primeiro, e não por capricho: metade do que está escrito
 * neste arquivo sobre teclado é comentário explicando uma conta que NÃO se deve
 * fazer, e um teste que lê comentário acusa a própria explicação.
 */
const SEM_COMENTARIO = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

function contas(): string[] {
  // Por DECLARAÇÃO, não por linha: `margin-bottom: calc(…)` quebrado em três
  // linhas esconde o nome da propriedade da linha que tem a conta.
  return SEM_COMENTARIO.split(";")
    .map((d) => d.replace(/\s+/g, " ").trim())
    .filter((d) => d.includes("var(--keyboard-height"))
    .map((d) => d.slice(d.lastIndexOf("{") + 1).trim());
}

describe("a única conta de teclado", () => {
  it("a gaveta desconta a medida da própria altura", () => {
    const b = bloco("body.is-mobile .workspace-drawer.axxa-keyboard-open {");
    expect(b).toContain("calc(100dvh - var(--keyboard-height, 0px))");
    // `100vh` vem ANTES como reserva pra quem não tem `dvh`. As duas linhas,
    // nessa ordem, ou o navegador antigo fica sem altura nenhuma.
    expect(b.indexOf("100vh")).toBeLessThan(b.indexOf("100dvh"));
  });

  it("as camadas da folha terminam onde a gaveta termina", () => {
    // Elas são `fixed` no mobile, e de QUEM elas são fixed depende da versão do
    // Obsidian (um ancestral com `contain` vira bloco contenedor). Medindo a
    // mesma altura da gaveta, o fim é o mesmo nos dois mundos — que é o mais
    // perto de "não ter conta própria" que dá pra chegar estando fora da
    // cadeia dela.
    const b = bloco(
      "body.is-mobile.axxa-keyboard-open .axxa-root .axxa-sheet-layer"
    );
    expect(b).toContain("calc(100dvh - var(--keyboard-height, 0px))");
    // `bottom: auto` explícito: com top, height e bottom definidos a regra fica
    // sobre-restrita e o navegador descarta um deles por conta própria.
    expect(b).toContain("bottom: auto");
  });

  it("a lista de quem desconta o teclado é ESTA, e ela é curta", () => {
    // Uma conta nova de teclado no CSS quebra este teste de propósito. Se ela
    // for mesmo necessária, entra aqui junto com o motivo — e o motivo tem que
    // dizer por que aquele elemento está FORA da cadeia da gaveta, porque quem
    // está dentro já herdou o desconto e somar de novo é o bug de sempre.
    const permitidas = new Set([
      // A gaveta, no fullscreen e no modo normal: a ÚNICA conta que importa.
      "height: calc(100vh - var(--keyboard-height, 0px)) !important",
      "height: calc(100dvh - var(--keyboard-height, 0px)) !important",
      // As camadas `fixed` da folha e da gaveta de navegação. `fixed` pode
      // escapar da cadeia (depende de quem tem `contain` na versão do
      // Obsidian), então elas repetem a altura dela em vez de herdar.
      "height: calc(100vh - var(--keyboard-height, 0px))",
      "height: calc(100dvh - var(--keyboard-height, 0px))",
      // Modais NATIVOS do Obsidian: `.modal-container` é filho do <body>, fora
      // da gaveta, e por isso desconta sozinho.
      "max-height: calc(100vh - var(--keyboard-height, 50vh) - 32px)",
      "margin-bottom: calc( var(--keyboard-height, 0px) + max(var(--safe-area-inset-bottom, 0px), 12px) )",
    ]);
    const novas = contas().filter((d) => !permitidas.has(d));
    expect(novas, "conta de teclado sem dono conhecido").toEqual([]);
  });

  it("ninguém soma o teclado como respiro — foi o bug 0.1.246", () => {
    // `padding-bottom: var(--keyboard-height)` num elemento que já está dentro
    // da gaveta encolhida conta a medida duas vezes, e o que devia encostar no
    // teclado salta pro topo da tela.
    const respiros = contas().filter((l) => /^padding-bottom:/.test(l));
    expect(respiros).toEqual([]);
  });
});

describe("o painel da assistente segue o composer", () => {
  it("é `absolute` dentro da raiz, sem medir teclado nenhum", () => {
    // Isto é o desenho da 0.7.28, e ele custou quatro tentativas: `fixed` era
    // contido pela folha (`will-change: transform` faz bloco contenedor) e
    // recortado pelo `overflow: hidden` dela. Absolute na raiz — que já encolhe
    // com a gaveta — é o mesmo chão do composer.
    const b = bloco(".axxa-root .axxa-assist-layer {");
    expect(b).toContain("position: absolute");
    expect(b).not.toContain("--keyboard-height");
    // E sem safe-area: a gaveta já termina acima da barra de gestos.
    expect(b).not.toContain("safe-area-inset-bottom");
  });
});
