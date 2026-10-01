import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// O cartão do composer: a sombra das bordas arredondadas e o contraste do
// seletor de modelo.

const CSS = readFileSync(resolve(__dirname, "../styles/main.css"), "utf8");
const SEM_COMENTARIO = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
const PROJETOS = readFileSync(resolve(__dirname, "../src/ui/ProjectsView.tsx"), "utf8");
const FORM = readFileSync(resolve(__dirname, "../src/ui/SheetForm.tsx"), "utf8");
const CHAT = readFileSync(resolve(__dirname, "../src/ui/ChatView.tsx"), "utf8");

/** Os corpos (sem comentários) de TODAS as regras cujo seletor é exatamente `seletor`. */
function blocos(seletor: string): string[] {
  const escapado = seletor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const re = new RegExp(`(?:^|[}\\s])${escapado}\\s*\\{([^}]*)\\}`, "g");
  return [...SEM_COMENTARIO.matchAll(re)].map((m) => m[1]);
}

describe("o seletor de modelo do composer tem contraste", () => {
  // Até a 0.9.19 a página de projeto também chamava as pílulas dela de
  // `axxa-pill(s)`; como vinha depois no CSS, deixava o botão do modelo com
  // `--text-faint`, fonte menor e cursor padrão.
  it("`.axxa-pill` e `.axxa-pills` têm UMA regra só", () => {
    expect(blocos(".axxa-root .axxa-pill")).toHaveLength(1);
    expect(blocos(".axxa-root .axxa-pills")).toHaveLength(1);
  });

  it("a pílula do modelo usa a cor de texto normal", () => {
    expect(blocos(".axxa-root .axxa-pill")[0]).toContain("var(--text-normal)");
  });

  it("a página de projeto usa as próprias classes", () => {
    expect(PROJETOS).not.toMatch(/"axxa-pills?"/);
    expect(PROJETOS).toContain("axxa-info-pill");
  });
});

describe("a sombra do composer acompanha a borda arredondada", () => {
  // A linha da troca texto/voz recorta o que passa dela. Rente ao cartão, a
  // sombra virava um retângulo de cantos vivos.
  const aberta = () =>
    blocos(
      '.axxa-root .axxa-swap:not([data-mode="voice"]) > .axxa-swap-row:first-child, ' +
        '.axxa-root .axxa-swap[data-mode="voice"] > .axxa-swap-row:last-child',
    );

  it("a linha aberta recorta com folga pra sombra", () => {
    const corpo = aberta()[0] ?? "";
    expect(corpo).toMatch(/overflow:\s*clip/);
    expect(corpo).toMatch(/overflow-clip-margin:\s*\d+px/);
  });

  it("a linha fechada continua recortando rente", () => {
    expect(blocos(".axxa-root .axxa-swap-row")[0]).toMatch(/overflow:\s*hidden/);
  });
});

describe("o cartão do composer é só do composer", () => {
  // Da 0.6.49 até a 0.9.19 o campo dos formulários também se chamava
  // `axxa-input`. A regra dele vinha depois e vestia o cartão (canto 14,
  // padding 12, borda e fundo de campo); o campo herdava a sombra e o vidro.
  it("só o ChatView usa a classe `axxa-input`; o formulário usa `axxa-field-input`", () => {
    expect(CHAT).toContain('className="axxa-input"');
    expect(FORM).not.toMatch(/"axxa-input[ "]/);
    expect(FORM).toContain("axxa-field-input");
  });

  it("`.axxa-root .axxa-input` tem UMA regra base — a do cartão", () => {
    const regras = blocos(".axxa-root .axxa-input");
    expect(regras).toHaveLength(1);
    expect(regras[0]).toMatch(/padding:\s*14px 14px 12px/);
    expect(regras[0]).toContain("var(--axxa-r-lg)");
  });

  it("nenhuma regra agrupa o cartão com campo de formulário", () => {
    expect(SEM_COMENTARIO).not.toMatch(/\.axxa-input,\s*\.axxa-root \.axxa-textarea/);
  });
});

describe("a sombra do cartão some antes da borda do painel", () => {
  // O painel do Obsidian recorta na borda dele, e o cartão tem só o padding
  // de baixo do `.axxa-composer` até ela. Com `0 6px 20px` a sombra ainda
  // tinha ~3% de preto ali e terminava numa linha reta.

  /** Φ, a normal acumulada (Abramowitz–Stegun 7.1.26 pro erf). */
  function phi(x: number): number {
    const z = Math.abs(x) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * z);
    const erf =
      1 -
      t *
        (0.254829592 +
          t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) *
        Math.exp(-z * z);
    return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
  }

  it("menos de 1% de preto a 15px do cartão", () => {
    const composer = blocos(".axxa-root .axxa-composer")[0];
    // padding: <topo> <lados> <baixo> — o terceiro valor é o de baixo
    const baixo = Number(composer.match(/padding:[^;]*\s(\d+)px;/)?.[1]);
    expect(baixo).toBe(15);

    const sombra = blocos(".axxa-root .axxa-input")[0].match(/box-shadow:([^;]+);/)?.[1] ?? "";
    const camadas = sombra.split(/,(?![^(]*\))/).map((c) => c.trim()).filter(Boolean);
    expect(camadas.length).toBeGreaterThan(0);
    let resto = 0;
    for (const c of camadas) {
      const [, dy, blur, spread = "0"] = c.match(/^-?[\d.]+(?:px)?\s+(-?[\d.]+)(?:px)?\s+([\d.]+)(?:px)?(?:\s+(-?[\d.]+)px)?/) ?? [];
      const alpha = Number(c.match(/rgba\([^)]*,\s*([\d.]+)\)/)?.[1] ?? 0);
      const sigma = Number(blur) / 2;
      const distancia = baixo - Number(dy) - Number(spread);
      resto += alpha * (sigma > 0 ? 1 - phi(distancia / sigma) : distancia > 0 ? 0 : 1);
    }
    expect(resto).toBeLessThan(0.01);
  });
});
