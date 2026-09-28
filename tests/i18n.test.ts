import { describe, it, expect } from "vitest";
import { getTranslations } from "../src/i18n";
import { EN_US } from "../src/i18n/en-us";

// O dicionário INGLÊS, olhado sozinho. O roteamento entre os dois locales e a
// paridade de chaves moram em i18n.dois.test.ts — aqui é só garantir que o EN
// continua sendo o EN. (Até 0.7.13 este arquivo afirmava que EN era o ÚNICO
// locale; o PT-BR voltou em 0.7.14, com seletor nas settings.)

describe("i18n — o dicionário inglês", () => {
  it("é o que sai pro locale en-us", () => {
    expect(getTranslations("en-us")).toBe(EN_US);
  });

  it("o dicionário mantém as seções principais + funções tipadas", () => {
    expect(typeof EN_US.agent).toBe("object");
    expect(typeof EN_US.vault).toBe("object");
    expect(typeof EN_US.ai.err.noKey).toBe("function");
    expect(EN_US.ai.err.noKey("OpenAI")).toContain("OpenAI");
  });

  it("textos-chave estão em inglês (sem resíduo PT)", () => {
    expect(EN_US.ai.thinking.toLowerCase()).not.toMatch(/pensando|aguarde/);
    expect(JSON.stringify(EN_US.agent).toLowerCase()).not.toContain("configurações");
  });
});
