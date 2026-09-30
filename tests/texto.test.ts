import { describe, it, expect } from "vitest";
import { texto } from "../src/core/texto";

describe("texto", () => {
  it("devolve string como está, inclusive vazia", () => {
    expect(texto("oi")).toBe("oi");
    expect(texto("")).toBe("");
  });

  it("não troca string vazia pelo padrão", () => {
    // Quem quer o padrão no vazio escreve `texto(v) || padrao` — aqui o
    // contrato é preservar o que veio.
    expect(texto("", "padrao")).toBe("");
  });

  it("converte número, booleano e bigint", () => {
    expect(texto(0)).toBe("0");
    expect(texto(-1.5)).toBe("-1.5");
    expect(texto(false)).toBe("false");
    expect(texto(10n)).toBe("10");
  });

  it("número não-finito cai no padrão (NaN na tela não diz nada)", () => {
    expect(texto(NaN)).toBe("");
    expect(texto(Infinity, "—")).toBe("—");
  });

  it("null e undefined caem no padrão", () => {
    expect(texto(null)).toBe("");
    expect(texto(undefined)).toBe("");
    expect(texto(null, "Sem título")).toBe("Sem título");
  });

  it("objeto e array NÃO viram [object Object]", () => {
    // O motivo da função existir: frontmatter escrito como mapa, ou argumento
    // que o modelo mandou como objeto, iam pra tela como "[object Object]".
    expect(texto({ a: 1 })).toBe("");
    expect(texto([1, 2])).toBe("");
    expect(texto({}, "default")).toBe("default");
  });

  it("função e símbolo caem no padrão", () => {
    expect(texto(() => "x")).toBe("");
    expect(texto(Symbol("s"))).toBe("");
  });
});
