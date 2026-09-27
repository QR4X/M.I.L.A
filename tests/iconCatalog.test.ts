import { describe, it, expect } from "vitest";
import {
  ICON_CATALOG,
  iconCatalogSize,
  iconCategoryOf,
} from "../src/iconCatalog";
import { PROJECT_ICONS } from "../src/projects";
import { SKILL_ICONS } from "../src/skills/skillFile";

// O catálogo é uma lista de NOMES, e nome de ícone é a única coisa aqui que
// falha em silêncio: `setIcon` do Obsidian não reclama de nome que não
// existe — ele não desenha nada, e o azulejo vira um buraco. Não dá pra
// conferir o conjunto do Obsidian daqui (ele mora no obsidian.asar da
// máquina, e isso foi conferido na hora de escrever a lista), mas dá pra
// guardar a FORMA do nome, que é onde o erro de digitação aparece.
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

describe("ICON_CATALOG", () => {
  it("todo nome tem a forma de um nome Lucide", () => {
    for (const cat of ICON_CATALOG)
      for (const ic of cat.icons) expect(ic, `${cat.id}/${ic}`).toMatch(KEBAB);
  });

  it("nenhum ícone aparece em duas categorias", () => {
    // Repetido, o mesmo ícone apareceria marcado em duas abas — e "já escolhi
    // este?" viraria uma pergunta sem resposta.
    const vistos = new Map<string, string>();
    for (const cat of ICON_CATALOG)
      for (const ic of cat.icons) {
        expect(vistos.get(ic), `${ic} repetido`).toBeUndefined();
        vistos.set(ic, cat.id);
      }
  });

  it("as categorias têm id e nome próprios, e nenhuma é vazia", () => {
    const ids = ICON_CATALOG.map((c) => c.id);
    const labels = ICON_CATALOG.map((c) => c.label);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
    for (const cat of ICON_CATALOG) expect(cat.icons.length).toBeGreaterThan(0);
  });

  it("toda categoria tem emblema, e emblema é um nome de ícone", () => {
    // O emblema é o que se acha sem ler, numa fileira de dez nomes de uma
    // palavra. Faltando um, a pílula fica com um buraco no lugar dele —
    // `setIcon` não reclama de nome que não existe.
    for (const cat of ICON_CATALOG) {
      expect(cat.icon, cat.id).toMatch(KEBAB);
      expect(cat.icon.length, cat.id).toBeGreaterThan(0);
    }
  });

  it("a contagem bate com o que está nas categorias", () => {
    // É o número que cada aba mostra antes do toque.
    const soma = ICON_CATALOG.reduce((n, c) => n + c.icons.length, 0);
    expect(iconCatalogSize()).toBe(soma);
    expect(soma).toBeGreaterThan(100);
  });
});

describe("iconCategoryOf", () => {
  it("acha a categoria de um ícone do catálogo", () => {
    expect(iconCategoryOf("plane")).toBe("travel");
    expect(iconCategoryOf("terminal")).toBe("code");
  });

  it("devolve null pro que não está lá", () => {
    // É o que faz o catálogo abrir na primeira aba em vez de quebrar quando o
    // ícone atual só existe na grade curta.
    expect(iconCategoryOf("folder-open")).toBeNull();
    expect(iconCategoryOf("")).toBeNull();
  });
});

describe("as grades curtas", () => {
  it("também são nomes de ícone bem formados", () => {
    for (const ic of [...PROJECT_ICONS, ...SKILL_ICONS])
      expect(ic, ic).toMatch(KEBAB);
  });
});
