import { describe, it, expect } from "vitest";
import { escolherModo, mensagemDoModo } from "../src/core/chatShare";

// Compartilhar tem três degraus porque nada disso é garantido dentro de um
// WebView. A regra é: ARQUIVO primeiro — quem recebe um .md no WhatsApp abre,
// guarda e reencaminha; quem recebe a conversa como mensagem recebe uma parede
// de texto que o app vai cortar.

const caps = (over: Partial<{ share: boolean; files: boolean; clipboard: boolean }> = {}) => ({
  share: false,
  files: false,
  clipboard: false,
  ...over,
});

describe("escolherModo", () => {
  it("com arquivo, manda o arquivo", () => {
    expect(escolherModo(caps({ share: true, files: true, clipboard: true }))).toBe(
      "file"
    );
  });

  it("sem arquivo mas com folha de compartilhamento, manda texto", () => {
    expect(escolherModo(caps({ share: true, clipboard: true }))).toBe("text");
  });

  it("sem folha nenhuma, copia", () => {
    // No desktop não existe folha do sistema: copiar é o gesto honesto.
    expect(escolherModo(caps({ clipboard: true }))).toBe("clipboard");
  });

  it("sem nada, diz que não dá", () => {
    // Melhor do que abrir a folha e não acontecer coisa nenhuma.
    expect(escolherModo(caps())).toBe("none");
  });

  it("`files` sem `share` não vale — quem envia é o share", () => {
    expect(escolherModo(caps({ files: true, clipboard: true }))).toBe("clipboard");
  });
});

describe("mensagemDoModo", () => {
  it("cada degrau conta o que fez", () => {
    expect(mensagemDoModo("file", "a.md")).toContain("a.md");
    expect(mensagemDoModo("text", "a.md")).toMatch(/text/i);
    expect(mensagemDoModo("clipboard", "a.md")).toMatch(/clipboard/i);
    expect(mensagemDoModo("none", "a.md")).toMatch(/no way/i);
  });
});
