import { describe, it, expect } from "vitest";
import { contar, proximaBeta, proximaEstavel, veredito, POR_BETA, POR_RELEASE } from "../scripts/lote.mjs";

// A régua do lote: 3 modificações → beta, 10 → release.

describe("o que conta como modificação", () => {
  it("fix, feat e perf contam — com ou sem escopo", () => {
    expect(
      contar([
        "fix(composer): sombra com cantos redondos (0.9.20)",
        "feat: nova aba",
        "perf(rag): índice mais leve",
        "feat(ui)!: troca a home",
      ]),
    ).toBe(4);
  });

  it("chore, docs, ci, test, refactor e style não contam", () => {
    expect(
      contar([
        "chore(data): weekly hot ranking update",
        "docs(readme): declara por que o streaming usa fetch",
        "ci(release): builds de teste como pré-release",
        "test: cobre o lote",
        "refactor(ui): extrai componente",
        "style: prettier",
      ]),
    ).toBe(0);
  });

  it("só o prefixo decide — 'fix' no meio da frase não conta", () => {
    expect(contar(["chore: fix: typo no comentário", "Merge branch 'main'"])).toBe(0);
  });
});

describe("a próxima versão", () => {
  it("a estável sobe o patch", () => {
    expect(proximaEstavel("0.9.19")).toBe("0.9.20");
    expect(proximaEstavel("1.0.9")).toBe("1.0.10");
  });

  it("a beta continua a contagem da mesma estável", () => {
    const tags = ["0.9.19", "0.9.20-beta.1", "0.9.20-beta.2", "0.9.18"];
    expect(proximaBeta("0.9.19", tags)).toBe("0.9.20-beta.3");
  });

  it("a primeira beta de uma versão nova é a .1", () => {
    expect(proximaBeta("0.9.20", ["0.9.20", "0.9.20-beta.4"])).toBe("0.9.21-beta.1");
  });

  it("beta.10 vem depois de beta.9 (número, não texto)", () => {
    const tags = Array.from({ length: 10 }, (_, i) => `0.9.20-beta.${i + 1}`);
    expect(proximaBeta("0.9.19", tags)).toBe("0.9.20-beta.11");
  });
});

describe("o veredito", () => {
  it(`beta a cada ${POR_BETA}`, () => {
    expect(veredito(2, 2)).toBe("nada");
    expect(veredito(3, 3)).toBe("beta");
  });

  it(`release com ${POR_RELEASE} desde a estável — vence a beta`, () => {
    expect(veredito(9, 0)).toBe("nada");
    expect(veredito(10, 3)).toBe("release");
  });
});
