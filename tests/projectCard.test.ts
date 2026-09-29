import { describe, it, expect } from "vitest";
import { resumoDoProjeto } from "../src/ui/projectSummary";
import type { Project } from "../src/projects";

// O CARTÃO de projeto responde três perguntas sem abrir o projeto: está vivo?
// do que se trata? quanto já tem?

const AGORA = new Date("2026-09-29T12:00:00Z").getTime();
const dias = (n: number) => new Date(AGORA - n * 86_400_000).toISOString();

const projeto = (p: Partial<Project> = {}): Project => ({
  id: "p1",
  name: "Tese",
  icon: "book",
  color: "default",
  sources: [],
  chatIds: [],
  createdAt: dias(5),
  ...p,
});

describe("está vivo?", () => {
  it("com conversas: quando foi a ÚLTIMA", () => {
    const r = resumoDoProjeto(
      projeto({ chatIds: ["a", "b"] }),
      [
        { id: "a", title: "Antiga", date: dias(9) },
        { id: "b", title: "Recente", date: dias(2) },
      ],
      AGORA
    );
    expect(r.quando).toBe("Active 2d ago");
  });

  it("sem conversa nenhuma: quando ele nasceu", () => {
    expect(resumoDoProjeto(projeto(), [], AGORA).quando).toBe("Created 5d ago");
  });

  it("agora mesmo não vira '0m ago'", () => {
    const r = resumoDoProjeto(
      projeto({ chatIds: ["a"] }),
      [{ id: "a", title: "x", date: new Date(AGORA - 5_000).toISOString() }],
      AGORA
    );
    expect(r.quando).toBe("Active just now");
  });

  it("mais de um mês: a data, sem 'ago' pendurado depois dela", () => {
    const r = resumoDoProjeto(projeto({ createdAt: dias(60) }), [], AGORA);
    expect(r.quando).toMatch(/^Created \d{4}-\d{2}-\d{2}$/);
  });
});

describe("do que se trata?", () => {
  it("a primeira linha das instruções — a frase que a pessoa escreveu", () => {
    const r = resumoDoProjeto(
      projeto({ instructions: "\n  Responda em português.\nCite a nota." }),
      [],
      AGORA
    );
    expect(r.sobre).toBe("Responda em português.");
  });

  it("sem instruções: o título da conversa mais recente", () => {
    const r = resumoDoProjeto(
      projeto({ chatIds: ["a", "b"] }),
      [
        { id: "a", title: "Antiga", date: dias(9) },
        { id: "b", title: "Kuhn e paradigmas", date: dias(1) },
      ],
      AGORA
    );
    expect(r.sobre).toBe("Latest: Kuhn e paradigmas");
  });

  it("sem os dois: nada — o cartão mostra a dica, não inventa assunto", () => {
    expect(resumoDoProjeto(projeto(), [], AGORA).sobre).toBeNull();
  });
});

describe("quanto já tem?", () => {
  it("conta só as conversas que EXISTEM", () => {
    // `chatIds` guarda id de conversa apagada também, e um "3 chats" que abre
    // em dois seria o cartão mentindo.
    const r = resumoDoProjeto(
      projeto({ chatIds: ["a", "apagada", "b"] }),
      [
        { id: "a", title: "A", date: dias(1) },
        { id: "b", title: "B", date: dias(2) },
        { id: "de-outro", title: "C", date: dias(0) },
      ],
      AGORA
    );
    expect(r.conversas).toBe(2);
  });
});
