import { describe, it, expect } from "vitest";
import { peDoWizard } from "../src/ui/wizard";
import { PASSOS_SKILL } from "../src/ui/SkillSheet";
import { SKILL_DRAFT_VAZIO } from "../src/skills/skillFile";

// Criar um skill é uma FILA de telas, uma pergunta por vez. Um formulário de
// sete blocos num celular é uma parede: a pessoa rola, vê tudo vazio de uma vez
// e fecha.
//
// O pé da fila é meia dúzia de ternários, e cada um deles já errou uma vez em
// algum formulário deste app. Aqui eles são casos.

const pe = (atual: number, total = 5, problema: string | null = null) =>
  peDoWizard({ atual, total, problema });

describe("os botões da fila", () => {
  it("no primeiro passo não há 'Back'", () => {
    // Voltar do primeiro passo é SAIR do formulário, e isso já é a seta da
    // barra de cima. Dois voltares na mesma tela querendo dizer coisas
    // diferentes é como se chamam armadilhas.
    expect(pe(0).back).toBe(false);
    expect(pe(1).back).toBe(true);
  });

  it("o do meio avança, o último conclui", () => {
    expect(pe(0).primario).toBe("next");
    expect(pe(3).primario).toBe("next");
    expect(pe(4).primario).toBe("submit");
    expect(pe(4).ultimo).toBe(true);
  });

  it("uma fila de UM passo é um formulário comum: conclui e não volta", () => {
    const p = pe(0, 1);
    expect(p.primario).toBe("submit");
    expect(p.back).toBe(false);
  });

  it("um índice além do fim não inventa um passo que não existe", () => {
    // Acontece se a lista de passos encolher com o estado do passo já em pé.
    expect(pe(9).primario).toBe("submit");
  });
});

describe("a linha de status", () => {
  it("o que FALTA só aparece onde há o que salvar", () => {
    // "Give it a name." na tela do prompt é um aviso sobre uma pergunta que a
    // fila ainda não fez — e a pessoa lê como erro do que acabou de escrever.
    expect(pe(0, 5, "Give it a name.").status).toBe(null);
    expect(pe(4, 5, "Give it a name.").status).toBe("problema");
  });

  it("pronto no meio do caminho vira ATALHO de concluir", () => {
    // O caso de quem pediu ajuda à assistente no primeiro passo e recebeu o
    // skill inteiro preenchido: o resto é enfeite, e ninguém deve tocar "Next"
    // quatro vezes pra sair de uma coisa que já está pronta.
    expect(pe(0).status).toBe("atalho");
    expect(pe(3).status).toBe("atalho");
  });

  it("no último passo, pronto, a linha some — não há o que dizer", () => {
    expect(pe(4).status).toBe(null);
  });

  it("problema e atalho nunca aparecem juntos", () => {
    // São a mesma pergunta ("posso acabar?") com as duas respostas possíveis,
    // e é por isso que dividem o mesmo lugar.
    for (let i = 0; i < 6; i++)
      for (const prob of [null, "falta algo"]) {
        const s = peDoWizard({ atual: i, total: 5, problema: prob }).status;
        expect(s === "problema" && prob === null).toBe(false);
        expect(s === "atalho" && prob !== null).toBe(false);
      }
  });

  it("o botão de concluir só se oferece quando dá", () => {
    // Ele não fica APAGADO: botão apagado não diz o que falta. Ele continua
    // clicável e explica — `pronto` é só o tom.
    expect(pe(4, 5, "falta").pronto).toBe(false);
    expect(pe(4).pronto).toBe(true);
  });
});

describe("os passos cobrem o skill", () => {
  it("todo campo do rascunho é perguntado em algum passo", () => {
    // Um campo novo no rascunho sem passo pra ele seria um campo que só existe
    // ao EDITAR: invisível pra quem cria, e é quem cria que precisa dele.
    const ids = new Set<string>(PASSOS_SKILL.map((p) => p.id));
    // "look" responde por dois de uma vez, e de propósito: a cor é o que pinta
    // o ícone, então separá-las seria escolher o desenho sem ver o tom.
    ids.delete("look");
    ids.add("color");
    ids.add("icon");
    expect([...Object.keys(SKILL_DRAFT_VAZIO)].sort()).toEqual([...ids].sort());
  });

  it("nenhum passo repetido, e o prompt vem primeiro", () => {
    const ids = PASSOS_SKILL.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    // O corpo é o skill: sem ele o parser descarta a nota. E é nele que a
    // assistente devolve a coisa inteira — começar por outro lugar seria
    // desperdiçar a única resposta que pode encerrar a fila.
    expect(ids[0]).toBe("body");
  });

  it("todo passo tem um rótulo curto — ele vai no TÍTULO da folha", () => {
    for (const p of PASSOS_SKILL) {
      expect(p.label.trim()).not.toBe("");
      expect(p.label.length).toBeLessThanOrEqual(14);
    }
  });
});
