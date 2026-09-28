import { describe, it, expect } from "vitest";
import {
  ehFree,
  escolherAssistente,
  motivoIndisponivel,
} from "../src/assistant/model";
import {
  lerObjeto,
  lerProjeto,
  lerSkill,
  lerPergunta,
  lerTexto,
  recortarJson,
} from "../src/assistant/parse";
import {
  idiomaDoApp,
  promptDescricao,
  promptInstrucoes,
  promptProjeto,
  promptSkill,
} from "../src/assistant/prompt";

// A assistente é um convidado, não um autor. Nada do que ela diz vira dado sem
// passar por uma lista nossa — e é aqui que isso é garantido. Um nome de ícone
// inventado não dá erro em lugar nenhum: `setIcon` não desenha, e o projeto
// nasce com um buraco no lugar do brasão.

const ICONES = ["folder", "graduation-cap", "plane"];
const CORES = ["default", "#e5484d", "#4361ee"];

describe("escolherAssistente", () => {
  it("a escolha explícita manda", () => {
    expect(
      escolherAssistente({
        assistantProvider: "openai",
        assistantModel: "gpt-5",
        favoriteModels: { openrouter: ["x/y:free"] },
      })
    ).toEqual({ provider: "openai", model: "gpt-5" });
  });

  it("sem escolha, pega o FAVORITO free do OpenRouter", () => {
    // Favorito primeiro porque favoritar é escolher — só que antes.
    expect(
      escolherAssistente({
        favoriteModels: { openrouter: ["pago/modelo", "meta/llama:free"] },
        activeModels: { openrouter: ["outro/coisa:free"] },
      })
    ).toEqual({ provider: "openrouter", model: "meta/llama:free" });
  });

  it("sem favorito free, cai pros modelos conhecidos", () => {
    expect(
      escolherAssistente({
        favoriteModels: { openrouter: ["pago/modelo"] },
        activeModels: { openrouter: ["pago/outro", "x/y:free"] },
      })
    ).toEqual({ provider: "openrouter", model: "x/y:free" });
  });

  it("sem nada servível, devolve null — que é convite, não erro", () => {
    expect(escolherAssistente({})).toBeNull();
    expect(
      escolherAssistente({ activeModels: { openrouter: ["só/pago"] } })
    ).toBeNull();
  });

  it("free é o sufixo, como no resto do app", () => {
    expect(ehFree("meta/llama:free")).toBe(true);
    expect(ehFree("meta/llama")).toBe(false);
  });
});

describe("motivoIndisponivel", () => {
  it("sem modelo e sem chave dizem coisas DIFERENTES", () => {
    // Uma mensagem só mandaria metade das pessoas pro lugar errado: sem chave
    // se cola uma, sem modelo se roda o SCAN.
    const semModelo = motivoIndisponivel(null, () => true);
    const semChave = motivoIndisponivel(
      { provider: "openrouter", model: "x:free" },
      () => false
    );
    expect(semModelo).toMatch(/model/i);
    expect(semChave).toMatch(/key/i);
    expect(semModelo).not.toBe(semChave);
  });

  it("com modelo e chave, não há motivo", () => {
    expect(
      motivoIndisponivel({ provider: "openrouter", model: "x:free" }, () => true)
    ).toBeNull();
  });
});

describe("recortarJson", () => {
  it("tira a cerca de código", () => {
    expect(recortarJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("acha o objeto no meio da prosa", () => {
    // Acontece o tempo todo com modelo pequeno: "Here's the JSON:" na frente e
    // um parágrafo de despedida atrás.
    expect(recortarJson('Sure! {"a":1} Hope that helps.')).toBe('{"a":1}');
  });

  it("sem objeto nenhum, devolve null em vez de lançar", () => {
    expect(recortarJson("desculpa, não entendi")).toBeNull();
    expect(lerObjeto("desculpa")).toBeNull();
  });

  it("JSON quebrado não derruba nada", () => {
    expect(lerObjeto('{"a": }')).toBeNull();
  });
});

describe("lerSkill", () => {
  const ok = {
    name: "Weekly review",
    description: "Go through the week",
    icon: "graduation-cap",
    color: "#4361ee",
    mode: "vault-qa",
    body: "Go through this week's notes and tell me what moved.",
  };

  it("passa o que é válido", () => {
    expect(lerSkill(ok, ICONES, "folder", CORES)).toEqual(ok);
  });

  it("skill também tem cor, e fora da paleta vira default", () => {
    // Skill tinha ícone e mais nada: numa grade de dois, todos os brasões eram
    // o mesmo cinza e o desenho miúdo era a única pista.
    expect(lerSkill({ ...ok, color: "roxo" }, ICONES, "folder", CORES)?.color).toBe(
      "default"
    );
    // Sem paleta declarada, o padrão continua servindo.
    expect(lerSkill(ok, ICONES, "folder")?.color).toBe("default");
  });

  it("ícone inventado vira o padrão, e não um buraco na tela", () => {
    const r = lerSkill({ ...ok, icon: "sparkles-2" }, ICONES, "folder", CORES);
    expect(r?.icon).toBe("folder");
  });

  it("modo inventado vira vazio (abre onde a pessoa estiver)", () => {
    expect(lerSkill({ ...ok, mode: "wizard" }, ICONES, "folder", CORES)?.mode).toBe("");
    expect(lerSkill({ ...ok, mode: "agent" }, ICONES, "folder", CORES)?.mode).toBe(
      "agent"
    );
  });

  it("sem corpo não é skill", () => {
    // Sem corpo o parser da nota descarta o arquivo, e o skill some no mesmo
    // segundo em que foi criado.
    expect(lerSkill({ ...ok, body: "" }, ICONES, "folder", CORES)).toBeNull();
    expect(lerSkill({ ...ok, body: 42 }, ICONES, "folder", CORES)).toBeNull();
  });

  it("corpo cercado de crase entra limpo", () => {
    const r = lerSkill({ ...ok, body: "```\nfaz isso\n```" }, ICONES, "folder", CORES);
    expect(r?.body).toBe("faz isso");
  });

  it("nome quilométrico não estoura o campo", () => {
    const r = lerSkill({ ...ok, name: "a".repeat(300) }, ICONES, "folder", CORES);
    expect(r!.name.length).toBeLessThanOrEqual(60);
  });
});

describe("lerProjeto", () => {
  const vault = ["Refs/Kuhn.md", "Diário/2026-09.md", "Ideias.md"];
  const ok = {
    name: "Tese",
    icon: "graduation-cap",
    color: "#4361ee",
    instructions: "Sempre citar a fonte.",
    notes: ["Refs/Kuhn.md"],
  };

  it("passa o que é válido", () => {
    expect(lerProjeto(ok, ICONES, CORES, vault)).toEqual(ok);
  });

  it("nota inventada é DESCARTADA", () => {
    // O modelo inventa caminho plausível com uma facilidade que assusta, e uma
    // fonte que não existe só aparece na primeira conversa do projeto.
    const r = lerProjeto(
      { ...ok, notes: ["Refs/Kuhn.md", "Projects/Tese.md"] },
      ICONES,
      CORES,
      vault
    );
    expect(r?.notes).toEqual(["Refs/Kuhn.md"]);
  });

  it("nota repetida entra uma vez só", () => {
    const r = lerProjeto(
      { ...ok, notes: ["Ideias.md", "Ideias.md"] },
      ICONES,
      CORES,
      vault
    );
    expect(r?.notes).toEqual(["Ideias.md"]);
  });

  it("cor fora da paleta vira o padrão", () => {
    expect(lerProjeto({ ...ok, color: "red" }, ICONES, CORES, vault)?.color).toBe(
      "default"
    );
  });

  it("sem nome não é projeto", () => {
    expect(lerProjeto({ ...ok, name: "  " }, ICONES, CORES, vault)).toBeNull();
  });

  it("`notes` que não é lista não quebra", () => {
    expect(
      lerProjeto({ ...ok, notes: "Refs/Kuhn.md" }, ICONES, CORES, vault)?.notes
    ).toEqual([]);
  });

  it("instrução vazia é válida — nem todo projeto tem o que dizer", () => {
    const r = lerProjeto({ ...ok, instructions: "" }, ICONES, CORES, vault);
    expect(r?.instructions).toBe("");
  });
});

describe("lerPergunta", () => {
  it("devolve a pergunta do modo guiado", () => {
    expect(lerPergunta({ ask: "Pra que você usa isso?" })).toBe(
      "Pra que você usa isso?"
    );
  });

  it("sem pergunta, string vazia", () => {
    expect(lerPergunta({ draft: {} })).toBe("");
    expect(lerPergunta(null)).toBe("");
  });
});

describe("os prompts", () => {
  it("o de skill leva os ícones permitidos", () => {
    const p = promptSkill("direto", ICONES, CORES, "English");
    expect(p).toContain("graduation-cap");
    expect(p).toContain("Do not ask questions");
  });

  it("o guiado permite perguntar, com teto", () => {
    expect(promptSkill("guiado", ICONES, CORES, "English")).toMatch(/up to 3/i);
  });

  it("sem notas, ele MANDA devolver lista vazia", () => {
    // Dizer "here are the notes:" e não mandar nada convida o modelo a
    // preencher o vazio com caminhos plausíveis.
    const p = promptProjeto("direto", ICONES, CORES, [], "English");
    expect(p).toContain('"notes": []');
    expect(p).not.toContain("Notes in this vault");
  });

  it("com notas, elas vão exatas", () => {
    const p = promptProjeto("direto", ICONES, CORES, ["A/b.md"], "English");
    expect(p).toContain("- A/b.md");
  });
});

describe("um campo só", () => {
  it("a descrição leva o prompt como matéria-prima", () => {
    // É o que faz ela poder escrever sem a pessoa digitar nada: o contexto já
    // está na tela.
    const p = promptDescricao({ name: "Weekly review", body: "Go through…", idioma: "English" });
    expect(p).toContain("Weekly review");
    expect(p).toContain("Go through…");
    expect(p).toContain('{"text": "..."}');
  });

  it("as instruções levam o projeto e as notas anexadas", () => {
    const p = promptInstrucoes({
      name: "Tese",
      notes: ["Refs/Kuhn.md"],
      atual: "",
      idioma: "Brazilian Portuguese",
    });
    expect(p).toContain("Project: Tese");
    expect(p).toContain("- Refs/Kuhn.md");
    // A regra que mais importa: elas SOMAM ao app, não substituem.
    expect(p).toMatch(/ADD to how the app already works/);
  });

  it("o que já está escrito vai junto pra ser MELHORADO", () => {
    // Pedir ajuda num campo com texto quer dizer "melhora isto", não "joga
    // fora e começa de novo".
    const p = promptInstrucoes({
      name: "Tese",
      notes: [],
      atual: "Sempre citar a fonte.",
      idioma: "Brazilian Portuguese",
    });
    expect(p).toContain("Sempre citar a fonte.");
    expect(p).toMatch(/improve on it/i);
  });

  it("campo vazio não manda uma seção vazia", () => {
    const p = promptInstrucoes({ name: "Tese", notes: [], atual: "   ", idioma: "English" });
    expect(p).not.toMatch(/improve on it/i);
    expect(p).not.toContain("Notes already attached");
  });

  it("lerTexto respeita o teto e limpa a cerca", () => {
    expect(lerTexto({ text: "```\noi\n```" }, 140)).toBe("oi");
    expect(lerTexto({ text: "a".repeat(500) }, 140).length).toBe(140);
    expect(lerTexto({ text: 42 }, 140)).toBe("");
    expect(lerTexto(null, 140)).toBe("");
  });
});

describe("o idioma", () => {
  // O app só fala dois. "Escreva no idioma da pessoa" parecia gentil e era uma
  // porta aberta: numa frase curta o modelo decide sozinho — e decidiu
  // norueguês num formulário onde o texto dele senta ao lado do texto do app.
  it("o locale vira o nome do idioma", () => {
    expect(idiomaDoApp("pt-br")).toBe("Brazilian Portuguese");
    expect(idiomaDoApp("en-us")).toBe("English");
    // Locale desconhecido não vira um terceiro idioma.
    expect(idiomaDoApp("nb-no")).toBe("English");
  });

  it("todos os prompts MANDAM escrever no idioma do app", () => {
    const todos = [
      promptSkill("direto", ICONES, CORES, "Brazilian Portuguese"),
      promptProjeto("direto", ICONES, CORES, [], "Brazilian Portuguese"),
      promptDescricao({ name: "x", body: "y", idioma: "Brazilian Portuguese" }),
      promptInstrucoes({
        name: "x",
        notes: [],
        atual: "",
        idioma: "Brazilian Portuguese",
      }),
    ];
    for (const p of todos) {
      expect(p).toContain("Write EVERY field in Brazilian Portuguese");
      // E a porta aberta não pode voltar.
      expect(p).not.toMatch(/same language the person used/i);
    }
  });
});
