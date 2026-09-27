// src/core/chatShare.ts
// COMPARTILHAR uma conversa — mandar o `.md` dela pra fora do aparelho.
//
// É o irmão do export (core/chatExport): lá a cópia fica no vault, aqui ela
// sai dele. A razão de existir é a mesma — a conversa mora em `.axxa/chats`,
// pasta que o Obsidian ignora, então não há arquivo pra você achar no
// explorador e anexar à mão.
//
// O caminho preferido é o ARQUIVO, não o texto: quem recebe um `.md` no
// WhatsApp abre, guarda e reencaminha; quem recebe a conversa como mensagem
// recebe uma parede de texto que o app de mensagem vai quebrar, cortar ou
// transformar em "ver mais".
//
// Mas nada disso é garantido dentro de um WebView. Então a escolha é feita por
// CAPACIDADE, em três degraus, e o app diz qual deles foi usado — silêncio
// aqui vira "toquei em compartilhar e não sei se saiu".

/** O que o aparelho oferece, medido na hora. */
export interface ShareCaps {
  /** `navigator.share` existe. */
  share: boolean;
  /** `navigator.canShare({ files })` aceita este arquivo. */
  files: boolean;
  /** `navigator.clipboard.writeText` existe. */
  clipboard: boolean;
}

export type ShareMode = "file" | "text" | "clipboard" | "none";

/**
 * Qual degrau usar. Arquivo > texto > área de transferência.
 *
 * O último não é "compartilhar", e é por isso que ele tem nome próprio: no
 * desktop não existe folha de compartilhamento, e copiar é o gesto honesto —
 * desde que a tela diga que foi isso que aconteceu.
 */
export function escolherModo(caps: ShareCaps): ShareMode {
  if (caps.share && caps.files) return "file";
  if (caps.share) return "text";
  if (caps.clipboard) return "clipboard";
  return "none";
}

/** O que a pessoa lê depois — cada degrau conta o que fez. */
export function mensagemDoModo(modo: ShareMode, nome: string): string {
  switch (modo) {
    case "file":
      return `Sharing ${nome}…`;
    case "text":
      return "This device can't share files — sharing the conversation as text.";
    case "clipboard":
      return "Copied the conversation to the clipboard.";
    default:
      return "This device has no way to share from here.";
  }
}

/** Mede o que existe AGORA (o arquivo entra na conta: o teste é por tipo). */
export function medirCaps(arquivo: File): ShareCaps {
  const nav =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & {
          canShare?: (d: unknown) => boolean;
          share?: (d: unknown) => Promise<void>;
        });
  let files = false;
  try {
    files = nav?.canShare?.({ files: [arquivo] }) === true;
  } catch {
    files = false;
  }
  return {
    share: typeof nav?.share === "function",
    files,
    clipboard: typeof navigator?.clipboard?.writeText === "function",
  };
}

/**
 * Compartilha, e devolve o degrau que foi usado (ou null se a pessoa fechou a
 * folha do sistema — cancelar não é erro e não merece aviso nenhum).
 */
export async function compartilharMarkdown(
  nomeArquivo: string,
  titulo: string,
  markdown: string
): Promise<ShareMode | null> {
  const arquivo = new File([markdown], nomeArquivo, {
    type: "text/markdown",
  });
  const modo = escolherModo(medirCaps(arquivo));
  const nav = navigator as Navigator & {
    share?: (d: unknown) => Promise<void>;
  };
  try {
    if (modo === "file") {
      await nav.share?.({ files: [arquivo], title: titulo });
      return modo;
    }
    if (modo === "text") {
      await nav.share?.({ title: titulo, text: markdown });
      return modo;
    }
    if (modo === "clipboard") {
      await navigator.clipboard.writeText(markdown);
      return modo;
    }
  } catch (err) {
    // `AbortError` é a pessoa fechando a folha do sistema. Qualquer outro erro
    // sobe pra quem chamou avisar.
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
  return modo;
}
