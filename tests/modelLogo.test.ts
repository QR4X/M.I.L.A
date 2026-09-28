import { describe, it, expect } from "vitest";
import { modelLogo, vendorDoModelo } from "../src/providers/modelLogo";
import { getModelFamily } from "../src/providers/modelFamily";

// O id de um modelo do OpenRouter carrega o FABRICANTE no prefixo, e a gente já
// tem os logos de seis marcas. Usar o logo certo num seletor é a diferença
// entre uma lista que se varre com o olho e uma que se lê.

describe("vendorDoModelo", () => {
  it("lê o prefixo", () => {
    expect(vendorDoModelo("anthropic/claude-3.5-sonnet")).toBe("anthropic");
    expect(vendorDoModelo("Meta-Llama/Llama-3.3")).toBe("meta-llama");
  });

  it("id sem fabricante devolve vazio", () => {
    expect(vendorDoModelo("gpt-5")).toBe("");
    expect(vendorDoModelo("")).toBe("");
  });
});

describe("modelLogo", () => {
  it("usa a MARCA quando temos", () => {
    expect(modelLogo("anthropic/claude-3.5-sonnet")).toBe("logo-anthropic");
    expect(modelLogo("openai/gpt-4o")).toBe("logo-openai");
    expect(modelLogo("google/gemini-2.5-pro")).toBe("logo-gemini");
    expect(modelLogo("nvidia/nemotron-70b")).toBe("logo-nvidia");
  });

  it("reconhece a casa mesmo sem fabricante no id", () => {
    // É como os providers diretos escrevem: "gpt-5", "claude-opus-4-8".
    expect(modelLogo("gpt-5")).toBe("logo-openai");
    expect(modelLogo("claude-opus-4-8")).toBe("logo-anthropic");
    expect(modelLogo("gemini-3-pro")).toBe("logo-gemini");
  });

  it("sem marca, cai no brasão da FAMÍLIA — nunca num genérico", () => {
    // Um "caixinha" pra todos seria pior que nada: ensinaria que o desenho não
    // quer dizer coisa alguma.
    expect(modelLogo("meta-llama/llama-3.3-70b:free")).toBe(
      getModelFamily("llama").icon
    );
    expect(modelLogo("deepseek/deepseek-chat:free")).toBe(
      getModelFamily("deepseek").icon
    );
    expect(modelLogo("mistralai/mixtral-8x22b")).toBe(
      getModelFamily("mistral").icon
    );
  });

  it("nunca devolve vazio — setIcon com nome vazio não desenha nada", () => {
    for (const id of ["", "coisa/estranha", "???"])
      expect(modelLogo(id).length).toBeGreaterThan(0);
  });
});
