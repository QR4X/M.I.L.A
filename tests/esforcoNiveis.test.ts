import { describe, it, expect } from "vitest";
import {
  DEFAULT_EFFORT_CONFIGS,
  EFFORT_DESCRIPTIONS,
  EFFORT_LEVELS,
  describeEffort,
} from "../src/core/effort";
import {
  CAMPOS_DE_ESFORCO,
  comCampo,
  limitar,
  nivelEditado,
  resumoDoNivel,
} from "../src/ui/settings/effortEditor";

// O que cada nível de esforço faz voltou a ser editável (a aba existia na
// v0.1.73 e sumiu na 0.4.0; o motor sempre leu `effortConfigs`).

describe("esforço por nível", () => {
  it("de fábrica, as descrições são as de antes, letra por letra", () => {
    expect(EFFORT_DESCRIPTIONS).toEqual({
      low: "Fast and economical (≤512 tok · 5 turns)",
      med: "Balanced (≤2k tok · 12 turns)",
      high: "Detailed (≤6k tok · 25 turns)",
      xhigh: "Deep (≤16k tok · 60 turns)",
      max: "Relentless (up to 80% of context · 200 turns)",
    });
  });

  it("editado, a descrição do composer mostra o número que vale", () => {
    expect(describeEffort("med", { med: { maxTokens: 3000, agentMaxTurns: 0 } })).toBe(
      "Balanced (≤3k tok · no turn cap)"
    );
    expect(describeEffort("max", { max: { contextReservePercent: 60 } })).toContain(
      "up to 60% of context"
    );
  });

  it("o editor cobre os nove ajustes, sem faltar nem sobrar", () => {
    const chaves = CAMPOS_DE_ESFORCO.map((c) => c.key).sort();
    expect(chaves).toEqual(Object.keys(DEFAULT_EFFORT_CONFIGS.med).sort());
    // e todo padrão de fábrica cabe no intervalo do próprio campo
    for (const l of EFFORT_LEVELS) {
      for (const c of CAMPOS_DE_ESFORCO.filter((x) => x.tipo === "numero")) {
        const v = DEFAULT_EFFORT_CONFIGS[l][c.key] as number;
        expect(limitar(v, c), `${l}.${c.key}`).toBe(v);
      }
    }
  });

  it("gravar o valor de fábrica (ou vazio) apaga a chave; nível sem nada some", () => {
    let o = comCampo({}, "low", "maxTokens", 900);
    expect(o).toEqual({ low: { maxTokens: 900 } });
    o = comCampo(o, "low", "temperature", 0.1);
    expect(o.low).toEqual({ maxTokens: 900, temperature: 0.1 });
    o = comCampo(o, "low", "maxTokens", DEFAULT_EFFORT_CONFIGS.low.maxTokens);
    expect(o.low).toEqual({ temperature: 0.1 });
    o = comCampo(o, "low", "temperature", undefined);
    expect(o).toEqual({});
    expect(nivelEditado(o, "low")).toBe(false);
  });

  it("toggle também: igual ao de fábrica não fica gravado", () => {
    const o = comCampo({}, "high", "parallelToolCalls", false);
    expect(o).toEqual({ high: { parallelToolCalls: false } });
    expect(comCampo(o, "high", "parallelToolCalls", true)).toEqual({});
  });

  it("a linha do nível resume os números de agora", () => {
    expect(resumoDoNivel({}, "med")).toBe("≤2k tok · 12 turns · temperature 0.7 · 5 notes");
    expect(resumoDoNivel({ med: { temperature: -1 } }, "med")).toContain("provider temperature");
  });

  it("limitar prende no intervalo do campo", () => {
    const temp = CAMPOS_DE_ESFORCO.find((c) => c.key === "temperature")!;
    expect(limitar(5, temp)).toBe(2);
    expect(limitar(-3, temp)).toBe(-1);
  });
});
