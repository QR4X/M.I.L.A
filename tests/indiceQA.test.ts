import { describe, it, expect } from "vitest";
import { QUANT_ITENS, pendenciaDoIndice } from "../src/ui/settings/indice";
import { QUANT_PROFILES } from "../src/rag/quant";
import { isControlKey } from "../src/ui/settings/values";

// A precisão e os pedaços do índice do Vault Q&A voltaram pra tela (sumiram no
// redesign da 0.4.0; o motor continuou lendo).

describe("o índice do Q&A: precisão e pedaços", () => {
  it("os quatro perfis do motor, nenhum a mais", () => {
    expect(QUANT_ITENS.map((i) => i.value).sort()).toEqual(Object.keys(QUANT_PROFILES).sort());
    for (const i of QUANT_ITENS) expect(i.icon, i.value).toBeTruthy();
  });

  it("as duas viraram controles que values.ts sabe gravar", () => {
    expect(isControlKey("ragQuantProfile")).toBe(true);
    expect(isControlKey("ragStreamShards")).toBe(true);
  });

  it("a linha do índice avisa o que só vale na próxima atualização", () => {
    const idx = { profile: "balanced", streamed: false };
    expect(pendenciaDoIndice(idx, { ragQuantProfile: "balanced", ragStreamShards: false })).toBeNull();
    expect(pendenciaDoIndice(idx, { ragQuantProfile: "light" })).toBe(
      "Update the index to apply the new precision."
    );
    expect(pendenciaDoIndice(idx, { ragStreamShards: true })).toBe(
      "Update the index to apply search in pieces."
    );
    expect(
      pendenciaDoIndice({ profile: "light", streamed: true }, { ragQuantProfile: "balanced" })
    ).toBe("Update the index to apply the new precision and a single index file.");
    // sem índice carregado não há o que avisar
    expect(pendenciaDoIndice(null, { ragQuantProfile: "light" })).toBeNull();
  });
});
