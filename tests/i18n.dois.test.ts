import { describe, it, expect } from "vitest";
import { EN_US } from "../src/i18n/en-us";
import { PT_BR } from "../src/i18n/pt-br";
import { getTranslations, LOCALES } from "../src/i18n";

// Dois idiomas, e o perigo de dois é o mesmo de sempre: um cresce e o outro
// não. Uma chave que nasce no inglês e não chega no português vira um pedaço
// de tela em inglês descoberto meses depois, por acaso, por quem está usando.
// O TypeScript já barra a chave FALTANDO (PT_BR é tipado por Translations);
// estes testes cuidam do resto — a que sobra, a que ficou igual por esquecimento
// e a que manda no idioma da resposta do modelo.

type Qualquer = Record<string, unknown>;

/** Todos os caminhos de folha do dicionário, em ordem. */
function caminhos(obj: Qualquer, prefixo = ""): string[] {
  const saida: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const caminho = prefixo ? `${prefixo}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v))
      saida.push(...caminhos(v as Qualquer, caminho));
    else saida.push(caminho);
  }
  return saida.sort();
}

/** A folha, já resolvida: função vira o texto que ela produz. */
function folha(obj: Qualquer, caminho: string): string {
  const v = caminho
    .split(".")
    .reduce<unknown>((o, k) => (o as Qualquer)?.[k], obj);
  if (typeof v === "function")
    return String((v as (...a: unknown[]) => unknown)(2, "x"));
  return String(v);
}

describe("os dois dicionários", () => {
  it("têm exatamente as mesmas chaves", () => {
    expect(caminhos(PT_BR as unknown as Qualquer)).toEqual(
      caminhos(EN_US as unknown as Qualquer)
    );
  });

  it("nenhum texto ficou idêntico ao inglês", () => {
    // Texto igual nos dois é quase sempre chave copiada e esquecida. Se algum
    // dia houver um legítimo (uma sigla, um nome próprio), ele entra na lista
    // de exceções aqui, à vista — não passa em silêncio.
    const iguaisPermitidos = new Set<string>([]);
    const iguais = caminhos(EN_US as unknown as Qualquer).filter(
      (c) =>
        !iguaisPermitidos.has(c) &&
        folha(EN_US as unknown as Qualquer, c) ===
          folha(PT_BR as unknown as Qualquer, c)
    );
    expect(iguais).toEqual([]);
  });

  it("os prompts de sistema mandam o modelo responder no idioma certo", () => {
    // Esta é a parte que NÃO é rótulo de tela: traduzir a interface e deixar o
    // prompt em inglês daria a pior combinação — tela em português com o
    // modelo respondendo em inglês dentro dela.
    expect(EN_US.systemPrompt.base).toMatch(/Answer in English/i);
    expect(PT_BR.systemPrompt.base).toMatch(/português do Brasil/i);
    expect(EN_US.agent.systemPrompt).toMatch(/Respond in English/i);
    expect(PT_BR.agent.systemPrompt).toMatch(/português do Brasil/i);
  });
});

describe("getTranslations", () => {
  it("entrega o dicionário do locale", () => {
    expect(getTranslations("pt-br")).toBe(PT_BR);
    expect(getTranslations("en-us")).toBe(EN_US);
  });

  it("locale desconhecido cai no inglês em vez de quebrar", () => {
    // `language` vem das settings, que são um JSON que dá pra editar na mão.
    expect(getTranslations("nb-no")).toBe(EN_US);
    expect(getTranslations("")).toBe(EN_US);
  });

  it("a lista de idiomas tem os dois, e só os dois", () => {
    expect(LOCALES.map((l) => l.id)).toEqual(["en-us", "pt-br"]);
  });
});
