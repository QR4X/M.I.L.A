// src/core/chatShare.ts
// COMPARTILHAR uma conversa — mandar o `.md` dela pra fora do aparelho.
//
// É o irmão do export (core/chatExport): lá a cópia fica no vault, aqui ela
// sai dele. A razão de existir é a mesma — a conversa mora em `.axxa/chats`,
// pasta que o Obsidian ignora, então não há arquivo pra você achar no
// explorador e anexar à mão.
//
// O PROBLEMA, medido no aparelho: o WebView do Obsidian no Android NÃO tem
// `navigator.share`. Web Share não é uma API do navegador embutido — ela
// precisa que o app hospedeiro a implemente, e o Obsidian não implementa. Então
// o caminho da web morre no primeiro degrau, e sobram os caminhos do APP:
//
//   1. Web Share com arquivo   — desktop e navegadores de verdade;
//   2. Capacitor Share         — o Obsidian mobile É um app Capacitor; se o
//                                plugin Share estiver embutido, é ELE quem abre
//                                a folha nativa do Android, com o arquivo;
//   3. "abrir com"             — API interna do Obsidian (`openWithDefaultApp`),
//                                que no Android abre o seletor do sistema pro
//                                arquivo. Não é a folha de compartilhar, mas
//                                tira o arquivo do app;
//   4. Web Share com texto     — sem arquivo, melhor o texto que nada;
//   5. área de transferência   — o desktop, onde folha de sistema não existe.
//
// Os degraus 2 e 3 precisam do arquivo EXISTINDO em disco, então eles exportam
// antes. Isso deixa uma cópia no vault de propósito: se a folha falhar no meio,
// a pessoa ainda tem o arquivo pra mandar do jeito dela.
//
// Cada degrau diz o que fez. Silêncio aqui vira "toquei em compartilhar e não
// sei se saiu" — foi exatamente assim que a versão anterior copiou pra área de
// transferência sem ninguém entender por quê.

import type { App } from "obsidian";
import type { ChatData } from "./chatPersistence";
import {
  exportChatMarkdown,
  exportChatToVault,
  exportFileName,
} from "./chatExport";

/** O que o aparelho oferece, medido na hora. */
export interface ShareCaps {
  /** `navigator.share` existe. */
  share: boolean;
  /** `navigator.canShare({ files })` aceita este arquivo. */
  files: boolean;
  /** O plugin Share do Capacitor está embutido no app hospedeiro. */
  capacitor: boolean;
  /** O Obsidian expõe "abrir com o app padrão" (API interna, só mobile). */
  openWith: boolean;
  /** `navigator.clipboard.writeText` existe. */
  clipboard: boolean;
}

export type ShareMode =
  | "file"
  | "capacitor"
  | "open-with"
  | "text"
  | "clipboard"
  | "none";

/**
 * Qual degrau usar. A ordem é a do que CHEGA MELHOR do outro lado: arquivo
 * pela folha do sistema > arquivo aberto pelo seletor > texto > copiar.
 */
export function escolherModo(caps: ShareCaps): ShareMode {
  if (caps.share && caps.files) return "file";
  if (caps.capacitor) return "capacitor";
  if (caps.openWith) return "open-with";
  if (caps.share) return "text";
  if (caps.clipboard) return "clipboard";
  return "none";
}

/** O que a pessoa lê depois — cada degrau conta o que fez. */
export function mensagemDoModo(modo: ShareMode, nome: string): string {
  switch (modo) {
    case "file":
    case "capacitor":
      return `Sharing ${nome}…`;
    case "open-with":
      return `Saved and opening ${nome} — pick where to send it.`;
    case "text":
      return "This device can't share files — sharing the conversation as text.";
    case "clipboard":
      return "No share sheet here — the conversation is on your clipboard.";
    default:
      return "This device has no way to share from here.";
  }
}

interface JanelaComCapacitor {
  Capacitor?: {
    Plugins?: {
      Share?: { share?: (opts: unknown) => Promise<unknown> };
    };
  };
}

interface AppComAbrir extends App {
  openWithDefaultApp?: (normalizedPath: string) => void;
}

/** Mede o que existe AGORA (o arquivo entra na conta: o teste é por tipo). */
export function medirCaps(app: App, arquivo: File): ShareCaps {
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
  const janela = (typeof window === "undefined"
    ? {}
    : window) as unknown as JanelaComCapacitor;
  return {
    share: typeof nav?.share === "function",
    files,
    capacitor:
      typeof janela.Capacitor?.Plugins?.Share?.share === "function",
    openWith:
      typeof (app as AppComAbrir).openWithDefaultApp === "function",
    clipboard: typeof navigator?.clipboard?.writeText === "function",
  };
}

/** Caminho absoluto de um arquivo do vault, quando o adapter souber dizer. */
function caminhoAbsoluto(app: App, relativo: string): string | null {
  const adapter = app.vault.adapter as { getBasePath?: () => string };
  const base = adapter.getBasePath?.();
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${relativo}`;
}

/**
 * Compartilha a conversa. Devolve o degrau usado, ou null se a pessoa fechou a
 * folha do sistema — cancelar não é erro e não merece aviso nenhum.
 */
export async function compartilharChat(
  app: App,
  chat: ChatData,
  quando: Date = new Date()
): Promise<ShareMode | null> {
  const nome = exportFileName(chat.title, quando);
  const markdown = exportChatMarkdown(chat, quando);
  const arquivo = new File([markdown], nome, { type: "text/markdown" });
  const caps = medirCaps(app, arquivo);
  const modo = escolherModo(caps);

  const nav = navigator as Navigator & {
    share?: (d: unknown) => Promise<void>;
  };
  const janela = window as unknown as JanelaComCapacitor;

  try {
    if (modo === "file") {
      await nav.share?.({ files: [arquivo], title: chat.title || "Chat" });
      return modo;
    }

    if (modo === "capacitor" || modo === "open-with") {
      // Estes dois precisam do arquivo em disco: a folha nativa recebe um
      // caminho, não um blob de JavaScript.
      const relativo = await exportChatToVault(app, chat, quando);
      if (modo === "capacitor") {
        const abs = caminhoAbsoluto(app, relativo);
        await janela.Capacitor?.Plugins?.Share?.share?.({
          title: chat.title || "Chat",
          files: [abs ? `file://${abs}` : relativo],
        });
        return modo;
      }
      (app as AppComAbrir).openWithDefaultApp?.(relativo);
      return modo;
    }

    if (modo === "text") {
      await nav.share?.({ title: chat.title || "Chat", text: markdown });
      return modo;
    }

    if (modo === "clipboard") {
      await navigator.clipboard.writeText(markdown);
      return modo;
    }
  } catch (err) {
    // `AbortError` é a pessoa fechando a folha do sistema.
    if (err instanceof DOMException && err.name === "AbortError") return null;
    if (err instanceof Error && /abort|cancel/i.test(err.message)) return null;
    throw err;
  }
  return modo;
}
