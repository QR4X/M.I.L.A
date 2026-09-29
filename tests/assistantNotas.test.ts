import { describe, it, expect } from "vitest";
import { lerNotas, lerProjeto } from "../src/assistant/parse";
import { promptNotas } from "../src/assistant/prompt";

// A assistente AJUDANDO A COLETAR NOTAS pra um projeto.
//
// É o único pedido dela em que a matéria-prima não é texto que a pessoa
// escreveu: é a lista de nomes do vault. Então os dois lados importam — o que
// sai (só caminhos, só com consentimento, com teto) e o que volta (nada que não
// exista no vault vira fonte de um projeto).

const VAULT = [
  "Tese/Kuhn - estrutura.md",
  "Tese/Lakatos.md",
  "DAILY/26-09-13.md",
  "Receitas/Bolo.md",
];

describe("lerNotas — só volta o que existe", () => {
  it("aceita os caminhos que estão na lista do vault", () => {
    expect(
      lerNotas({ notes: ["Tese/Lakatos.md", "Tese/Kuhn - estrutura.md"] }, VAULT)
    ).toEqual(["Tese/Lakatos.md", "Tese/Kuhn - estrutura.md"]);
  });

  it("descarta caminho inventado — modelo pequeno inventa nome plausível", () => {
    // Uma fonte que aponta pra nota nenhuma é um projeto que diz saber uma
    // coisa que não sabe.
    expect(
      lerNotas({ notes: ["Tese/Popper.md", "Tese/Lakatos.md"] }, VAULT)
    ).toEqual(["Tese/Lakatos.md"]);
  });

  it("não devolve as que já estão escolhidas", () => {
    // Sugestão repetida parece um botão que não fez nada.
    expect(
      lerNotas(
        { notes: ["Tese/Lakatos.md", "Tese/Kuhn - estrutura.md"] },
        VAULT,
        ["Tese/Lakatos.md"]
      )
    ).toEqual(["Tese/Kuhn - estrutura.md"]);
  });

  it("sem repetidas, e no máximo dez", () => {
    const muitas = Array.from({ length: 15 }, (_, i) => `N/${i}.md`);
    expect(lerNotas({ notes: [...muitas, ...muitas] }, muitas)).toHaveLength(10);
    expect(
      lerNotas({ notes: ["Tese/Lakatos.md", "Tese/Lakatos.md"] }, VAULT)
    ).toEqual(["Tese/Lakatos.md"]);
  });

  it("resposta torta vira lista vazia, não erro", () => {
    expect(lerNotas(null, VAULT)).toEqual([]);
    expect(lerNotas({ notes: "Tese/Lakatos.md" }, VAULT)).toEqual([]);
    expect(lerNotas({ notes: [1, null, { p: 1 }] }, VAULT)).toEqual([]);
  });

  it("o ✨ do projeto inteiro filtra as notas pelo MESMO critério", () => {
    // Os dois pedidos que devolvem notas passam pela mesma peneira — uma
    // segunda regra seria uma segunda chance de deixar passar caminho falso.
    const p = lerProjeto(
      { name: "Tese", notes: ["Tese/Popper.md", "Tese/Lakatos.md", "Tese/Lakatos.md"] },
      ["folder"],
      ["default"],
      VAULT
    );
    expect(p?.notes).toEqual(["Tese/Lakatos.md"]);
  });
});

describe("promptNotas — o que vai pro modelo", () => {
  const base = {
    name: "Tese de mestrado",
    instructions: "",
    escolhidas: [] as string[],
    caminhos: VAULT,
    idioma: "Brazilian Portuguese",
  };

  it("manda os caminhos, e pede de volta EXATAMENTE deles", () => {
    const p = promptNotas(base);
    for (const c of VAULT) expect(p).toContain(`- ${c}`);
    expect(p).toMatch(/exact paths/i);
    expect(p).toContain('{"notes"');
  });

  it("manda o nome do projeto, e as instruções quando existem", () => {
    expect(promptNotas(base)).toContain("Tese de mestrado");
    const comInstr = promptNotas({ ...base, instructions: "Foco em Kuhn." });
    expect(comInstr).toContain("Foco em Kuhn.");
    expect(promptNotas(base)).not.toMatch(/Its instructions/);
  });

  it("avisa o que já está escolhido, pra não voltar repetido", () => {
    const p = promptNotas({ ...base, escolhidas: ["Tese/Lakatos.md"] });
    expect(p).toMatch(/Already attached/);
    expect(p).toContain("- Tese/Lakatos.md");
  });

  it("no idioma do app", () => {
    expect(promptNotas(base)).toContain("Brazilian Portuguese");
  });
});
