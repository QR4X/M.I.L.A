import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EMBEDDING_PROVIDERS, somarDescobertos } from "../src/rag/descobertos";

// O "Fetch models" de cada provider volta a trazer os modelos de EMBEDDING da
// conta (era assim até a 0.3.x): eles alimentam a lista do Vault Q&A.

describe("embeddings descobertos", () => {
  it("o Fetch de modelos traz os de embedding junto", () => {
    const tab = readFileSync(resolve(__dirname, "../src/ui/SettingsTab.ts"), "utf8");
    expect(tab).toMatch(/this\.plugin\.scanEmbeddings\(providerId\)/);
    expect(EMBEDDING_PROVIDERS).toEqual(["openai", "openrouter", "gemini", "nim"]);
  });

  it("somar descobertos não repete e mantém os antigos na frente", () => {
    expect(somarDescobertos(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
    expect(somarDescobertos(undefined, ["x"])).toEqual(["x"]);
  });
});
