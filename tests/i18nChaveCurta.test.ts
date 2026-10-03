import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { chaveCurta } from "../src/i18n/chave";
import { traduzirCom } from "../src/i18n/tr";
// @ts-expect-error -- módulo .mjs do build, sem tipos
import { chaveCurta as chaveDoBuild, parteCurta } from "../scripts/chaveCurta.mjs";

// O build de produção troca as chaves em inglês do dicionário pt-BR por uma
// chave curta (o hash da frase). Três garantias: a conta do código e a do
// build são a mesma; cada tradução continua achável pela frase em inglês; e
// nenhum par de frases diferentes cai na mesma chave.

const PASTA = resolve(__dirname, "../src/i18n/ui-pt");
const partes = readdirSync(PASTA).filter((f) => f !== "index.ts");

describe("a chave curta do dicionário", () => {
  it("o código e o build fazem a mesma conta (acento, emoji e travessão inclusive)", () => {
    for (const t of ["", "Left today", "Gasto diário — 80%", "Ran {n} actions", "🎉 ok", "ç·…“”"]) {
      expect(chaveCurta(t)).toBe(chaveDoBuild(t));
      expect(chaveCurta(t).length).toBeLessThanOrEqual(7);
    }
  });

  it("cada parte transformada acha toda tradução pela frase em inglês", async () => {
    const vistas = new Map<string, string>();
    let total = 0;
    for (const f of partes) {
      const ts = readFileSync(join(PASTA, f), "utf8");
      const { curto } = (await parteCurta(ts, f, vistas)) as { curto: Record<string, string> };
      const js = await import(`../src/i18n/ui-pt/${f.replace(/\.ts$/, "")}`);
      const fonte = Object.values(js)[0] as Record<string, string>;
      for (const [ingles, pt] of Object.entries(fonte)) {
        expect(traduzirCom(curto, ingles), ingles).toBe(pt);
        total++;
      }
      // e o dicionário curto não carrega nenhuma frase em inglês como chave
      expect(Object.keys(curto).every((k) => /^[0-9a-z]{1,7}$/.test(k))).toBe(true);
    }
    expect(total).toBeGreaterThan(900);
  });

  it("duas frases diferentes com a mesma chave param o build", async () => {
    const vistas = new Map<string, string>([[chaveCurta("Left today"), "outra frase"]]);
    await expect(
      parteCurta(`export const X: Record<string, string> = { "Left today": "Sobra hoje" };`, "x.ts", vistas)
    ).rejects.toThrow(/mesma chave curta/);
  });
});
