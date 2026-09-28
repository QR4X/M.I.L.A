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

// A fila REAL: nada de 5 ou 6 escritos à mão aqui. Quando um passo entra ou
// sai — e já aconteceu, quando "Look" virou Color e Icon —, o que muda é a
// lista, não vinte números espalhados por este arquivo.
const TOTAL = PASSOS_SKILL.length;
const ULTIMO = TOTAL - 1;

const pe = (atual: number, problema: string | null = null, total = TOTAL) =>
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
    expect(pe(ULTIMO - 1).primario).toBe("next");
    expect(pe(ULTIMO).primario).toBe("submit");
    expect(pe(ULTIMO).ultimo).toBe(true);
  });

  it("uma fila de UM passo é um formulário comum: conclui e não volta", () => {
    const p = pe(0, null, 1);
    expect(p.primario).toBe("submit");
    expect(p.back).toBe(false);
  });

  it("um índice além do fim não inventa um passo que não existe", () => {
    // Acontece se a lista de passos encolher com o estado do passo já em pé.
    expect(pe(TOTAL + 4).primario).toBe("submit");
  });
});

describe("a linha de status", () => {
  it("o que FALTA só aparece onde há o que salvar", () => {
    // "Give it a name." na tela do prompt é um aviso sobre uma pergunta que a
    // fila ainda não fez — e a pessoa lê como erro do que acabou de escrever.
    expect(pe(0, "Give it a name.").status).toBe(null);
    expect(pe(ULTIMO, "Give it a name.").status).toBe("problema");
  });

  it("pronto no meio do caminho vira ATALHO de concluir", () => {
    // O caso de quem pediu ajuda à assistente no primeiro passo e recebeu o
    // skill inteiro preenchido: o resto é enfeite, e ninguém deve atravessar a
    // fila inteira pra sair de uma coisa que já está pronta.
    expect(pe(0).status).toBe("atalho");
    expect(pe(ULTIMO - 1).status).toBe("atalho");
  });

  it("no último passo, pronto, a linha some — não há o que dizer", () => {
    expect(pe(ULTIMO).status).toBe(null);
  });

  it("problema e atalho nunca aparecem juntos", () => {
    // São a mesma pergunta ("posso acabar?") com as duas respostas possíveis,
    // e é por isso que dividem o mesmo lugar.
    for (let i = 0; i <= TOTAL; i++)
      for (const prob of [null, "falta algo"]) {
        const s = peDoWizard({ atual: i, total: TOTAL, problema: prob }).status;
        expect(s === "problema" && prob === null).toBe(false);
        expect(s === "atalho" && prob !== null).toBe(false);
      }
  });

  it("o botão de concluir só se oferece quando dá", () => {
    // Ele não fica APAGADO: botão apagado não diz o que falta. Ele continua
    // clicável e explica — `pronto` é só o tom.
    expect(pe(ULTIMO, "falta").pronto).toBe(false);
    expect(pe(ULTIMO).pronto).toBe(true);
  });
});

describe("os passos cobrem o skill", () => {
  it("uma pergunta por tela: um passo por campo, nem mais nem menos", () => {
    // Os dois lados importam. Um campo do rascunho SEM passo é um campo que só
    // existe ao editar — invisível pra quem cria, e é quem cria que precisa
    // dele. E um passo com DOIS campos dentro deixa de ser uma pergunta por
    // tela, que é a regra inteira do wizard: cor e ícone já dividiram um passo
    // chamado "Look" com o argumento de serem "a mesma decisão", e não eram.
    const ids = PASSOS_SKILL.map((p) => p.id as string).sort();
    expect(ids).toEqual([...Object.keys(SKILL_DRAFT_VAZIO)].sort());
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
