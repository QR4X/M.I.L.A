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

  it("as camadas da folha entram na CAIXA do composer, sem conta própria", () => {
    // Com o teclado aberto elas deixam de ser `fixed` e viram `absolute` dentro
    // da `.axxa-root` — a mesma caixa onde o composer é o último item em fluxo.
    const b = bloco(
      ".workspace-drawer.axxa-keyboard-open .axxa-root .axxa-sheet-layer"
    );
    expect(b).toContain("position: absolute");
    expect(b).not.toContain("--keyboard-height");
    // `height: auto` desfaz a conta que esta regra já teve — sem ele, uma
    // altura antiga sobreviveria à troca de mecanismo.
    expect(b).toContain("height: auto");
    // E é uma COLUNA, como a do composer: quem decide onde a folha acaba é o
    // fim dela, não um número.
    expect(b).toContain("display: flex");
    expect(b).toContain("flex-direction: column");
  });

  it("presa ao MESMO sinal que encolhe a gaveta, não só ao do body", () => {
    // A gaveta — que é o que o composer segue — encolhe pela classe NA GAVETA.
    // A folha dependia só da classe no body. O mesmo observer põe as duas, mas
    // "juntas" não é "o mesmo sinal", e o composer nunca dependeu do body.
    const regra = CSS.slice(
      CSS.indexOf("/* Teclado aberto: a folha vira o COMPOSER."),
      CSS.indexOf("{", CSS.indexOf("/* Teclado aberto: a folha vira o COMPOSER."))
    );
    expect(regra).toContain(".workspace-drawer.axxa-keyboard-open .axxa-root .axxa-sheet-layer");
    expect(regra).toContain("body.is-mobile.axxa-keyboard-open .axxa-root .axxa-sheet-layer");
  });

  it("a folha é um item flex SEM altura calculada e sem transição de altura", () => {
    // Foi isto que o vídeo do aparelho mostrou: 100ms depois de a barra do
    // SwiftKey sumir, o botão SUBIA — a folha andava ao contrário do composer.
    // As duas coisas que ela tinha e ele não: `min/max-height: 94%` e uma
    // transição de 260ms nessas alturas. Aqui, nenhuma das duas.
    const b = bloco(
      ".workspace-drawer.axxa-keyboard-open .axxa-root .axxa-sheet-layer .axxa-sheet"
    );
    expect(b).toContain("flex: 1 1 auto");
    expect(b).toContain("min-height: 0");
    expect(b).toContain("max-height: none");
    expect(b).not.toMatch(/\d+%/);
    // O transform continua animado (abre, fecha, segue o dedo); altura não.
    expect(b).toMatch(/transition:\s*transform[^;]*;/);
    expect(b).not.toMatch(/transition:[^;]*(min-height|max-height)/);
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
  });
});

describe("o respiro embaixo do último botão é o que JÁ funciona no aparelho", () => {
  // Uma versão chegou a usar 36px aqui, com a teoria de que a medida do
  // teclado era curta e o composer errava igual; os prints dele provaram o
  // contrário. Depois, 8px (o do composer) deixou o botão da folha cortado num
  // campo de uma linha com a barra do SwiftKey visível — enquanto o painel da
  // assistente, na MESMA caixa, ficava inteiro com 15px.
  it("o rodapé da folha usa EXATAMENTE o respiro do painel da assistente", () => {
    // Iguais por construção: se um mudar sem o outro, este teste quebra. É o
    // painel que está confirmado no aparelho em todos os estados do teclado.
    const valor = (b: string) =>
      /padding-bottom:\s*([^;]+);/.exec(
        b.replace(/\/\*[\s\S]*?\*\//g, "")
      )?.[1].trim();
    const folha = valor(
      bloco("body.axxa-keyboard-open .axxa-root .axxa-sheet-actions,")
    );
    const painel = valor(bloco(".axxa-root .axxa-assist-layer {"));
    expect(folha).toBe("15px");
    expect(folha).toBe(painel);
  });

  it("o composer continua com o respiro dele", () => {
    // O composer está certo como está — ninguém mexe nele por tabela.
    const c = bloco("body.is-mobile .axxa-keyboard-open .axxa-composer,");
    expect(c).toContain("padding-bottom: var(--axxa-2)");
  });

  it("o painel da assistente usa os 15px do composer", () => {
    const b = bloco(".axxa-root .axxa-assist-layer {");
    expect(b).toContain("padding-bottom: 15px");
    expect(CSS).not.toContain("--axxa-ime-slack:");
  });

  it("o cartão da assistente desce por margem, não por `justify-content`", () => {
    // A camada ROLA, e num contêiner que rola o motor pode trocar `flex-end`
    // por `start` quando acha que há transbordo — no aparelho o cartão abriu no
    // TOPO da tela. `margin-top: auto` não tem essa exceção.
    // Sem os comentários: o da própria regra explica por que NÃO é flex-end,
    // e um teste que lê comentário acusa a explicação.
    const camada = bloco(".axxa-root .axxa-assist-layer {").replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    );
    expect(camada).not.toMatch(/justify-content:\s*flex-end/);
    const cartao = bloco(".axxa-root .axxa-assist-layer .axxa-assist {");
    expect(cartao).toContain("margin-top: auto");
  });
});
