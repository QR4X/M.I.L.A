import { describe, it, expect } from "vitest";
import { escolherModo, mensagemDoModo } from "../src/core/chatShare";

// Compartilhar tem degraus porque nada disso é garantido dentro de um WebView.
// O medido no aparelho: o Obsidian mobile NÃO tem `navigator.share` — Web Share
// precisa que o app hospedeiro implemente, e ele não implementa. Então o
// caminho da web morre no primeiro degrau e valem os caminhos do APP.
//
// A ordem é a do que CHEGA MELHOR do outro lado: arquivo pela folha do sistema,
// arquivo pelo seletor de "abrir com", texto, copiar.

const caps = (
  over: Partial<{
    share: boolean;
    files: boolean;
    capacitor: boolean;
    openWith: boolean;
    clipboard: boolean;
  }> = {}
) => ({
  share: false,
  files: false,
  capacitor: false,
  openWith: false,
  clipboard: false,
  ...over,
});

describe("escolherModo", () => {
  it("navegador de verdade: arquivo pela Web Share", () => {
    expect(escolherModo(caps({ share: true, files: true, clipboard: true }))).toBe(
      "file"
    );
  });

  it("Obsidian mobile: sem Web Share, quem abre a folha é o Capacitor", () => {
    expect(escolherModo(caps({ capacitor: true, openWith: true, clipboard: true }))).toBe(
      "capacitor"
    );
  });

  it("sem Capacitor, cai no 'abrir com' do sistema", () => {
    // Não é a folha de compartilhar, mas tira o arquivo do app — e é melhor
    // que mandar a conversa como parede de texto.
    expect(escolherModo(caps({ openWith: true, clipboard: true }))).toBe(
      "open-with"
    );
  });

  it("só Web Share sem arquivo: manda texto", () => {
    expect(escolherModo(caps({ share: true, clipboard: true }))).toBe("text");
  });

  it("desktop: sem folha nenhuma, copia", () => {
    expect(escolherModo(caps({ clipboard: true }))).toBe("clipboard");
  });

  it("sem nada, diz que não dá", () => {
    expect(escolherModo(caps())).toBe("none");
  });

  it("`files` sem `share` não vale — quem envia é o share", () => {
    expect(escolherModo(caps({ files: true, clipboard: true }))).toBe("clipboard");
  });

  it("o arquivo ganha do texto mesmo quando os dois existem", () => {
    expect(
      escolherModo(caps({ share: true, files: true, capacitor: true }))
    ).toBe("file");
  });
});

describe("mensagemDoModo", () => {
  it("cada degrau conta o que fez", () => {
    expect(mensagemDoModo("file", "a.md")).toContain("a.md");
    expect(mensagemDoModo("capacitor", "a.md")).toContain("a.md");
    // "Abrir com" salva antes: a frase avisa das duas coisas.
    expect(mensagemDoModo("open-with", "a.md")).toMatch(/saved/i);
    expect(mensagemDoModo("text", "a.md")).toMatch(/text/i);
    expect(mensagemDoModo("clipboard", "a.md")).toMatch(/clipboard/i);
    expect(mensagemDoModo("none", "a.md")).toMatch(/no way/i);
  });
});
