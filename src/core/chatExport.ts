// src/core/chatExport.ts
// EXPORTAR uma conversa: tirar uma cópia legível dela pra dentro do vault.
//
// Isto existe por causa de onde as conversas moram. Elas ficam em `.axxa/chats`
// — pasta com ponto, que o Obsidian ignora de propósito (ver core/vaultPaths):
// não entra no índice, na busca, no grafo, nem abre com um clique. É o certo
// pro dado do app, e é exatamente por isso que "abrir a nota da conversa" não
// existe neste menu: não haveria nota pra abrir.
//
// Então exportar não é duplicar por duplicar: é a ÚNICA porta entre o que você
// conversou e o seu vault. A cópia é uma nota comum, numa pasta visível, que
// se linka, se busca e se edita como qualquer outra.
//
// O que sai no caminho: os comentários HTML que o app usa pra remontar a
// conversa (timestamps, reações e os passos do agente em base64). Eles são
// invisíveis no preview, mas não no editor — e uma nota que abre com um
// paredão de base64 não é uma nota, é um despejo.

import type { App } from "obsidian";
import type { ChatData } from "./chatPersistence";
import { ensureFolder } from "./chatPersistence";

/** Pasta das cópias. Visível, ao lado dos relatórios. */
export const EXPORTS_FOLDER = "axxa-ai/exports";

/** Tira do markdown o que era recado do app pro app. */
export function limparMarcas(texto: string): string {
  return texto
    .replace(/<!--\s*axxa-steps:[\s\S]*?-->/g, "")
    .replace(/<!--\s*axxa:[^>]*-->\n?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Nome de arquivo a partir do título — o que o Obsidian não aceita, sai.
 *
 * A EXTENSÃO é escolha de quem chama, e não é detalhe: no Android é ela que
 * decide o tipo do arquivo, e o tipo decide QUEM aparece na folha de
 * compartilhar. `.md` vira `text/markdown`, que o WhatsApp não aceita — ele
 * declara `text/plain`. Por isso a cópia que vai pro vault é `.md` (é uma nota)
 * e a que sai pelo compartilhamento é `.txt` (é um anexo).
 */
export function exportFileName(
  titulo: string,
  quando: Date,
  extensao = "md"
): string {
  const base =
    titulo
      .replace(/[\\/:*?"<>|#^[\]]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/^[.\s]+|[.\s]+$/g, "")
      .trim()
      .slice(0, 60) || "chat";
  const dia = quando.toISOString().slice(0, 10);
  return `${base} (${dia}).${extensao}`;
}

/**
 * Nome SEM espaço, sem parêntese e sem acento — pra quem vai ler ele como URL.
 *
 * Isto não é preciosismo: no Android, quem descobre o tipo de um arquivo a
 * partir do caminho é o `MimeTypeMap.getFileExtensionFromUrl`, e ele roda uma
 * regex de URL. Espaço e parêntese fazem a regex não casar, a extensão sai
 * vazia, e o tipo cai no CORINGA (asterisco barra asterisco). Com ele, a folha
 * de compartilhar do Android mostra editor de imagem, navegador e app de
 * banco — mas NÃO mostra o WhatsApp, que só declara tipos específicos.
 *
 * "Rewrite the plugin README (2026-09-27).txt" não casa.
 * "rewrite-the-plugin-readme-2026-09-27.txt" casa, vira `text/plain`, e a
 * folha muda de gente.
 */
export function shareFileName(
  titulo: string,
  quando: Date,
  extensao = "txt"
): string {
  const base =
    titulo
      // Tira acento sem tirar a letra: "Revisão" → "Revisao".
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50)
      .replace(/-+$/g, "") || "chat";
  return `${base}-${quando.toISOString().slice(0, 10)}.${extensao}`;
}

/**
 * A nota exportada: frontmatter curto + a conversa em seções.
 *
 * O frontmatter é o mínimo que faz a cópia ser útil DEPOIS — de onde ela veio,
 * quando, com qual modelo. Sem ele, daqui a três meses é um texto órfão.
 */
export function exportChatMarkdown(chat: ChatData, quando: Date): string {
  const fm = [
    "---",
    `title: ${JSON.stringify(chat.title || "Untitled")}`,
    `date: ${JSON.stringify(chat.date)}`,
    `exported: ${JSON.stringify(quando.toISOString())}`,
    `model: ${JSON.stringify(chat.model)}`,
    `provider: ${JSON.stringify(chat.provider)}`,
    `mode: ${JSON.stringify(chat.mode)}`,
    "source: AXXA",
    "---",
  ].join("\n");

  const corpo = chat.messages
    .map((m) => {
      const quem = m.type === "user" ? "You" : "Assistant";
      return `## ${quem}\n\n${limparMarcas(m.content)}`;
    })
    .join("\n\n");

  return `${fm}\n\n# ${chat.title || "Untitled"}\n\n${corpo}\n`;
}

/** Grava a cópia e devolve o caminho. Não toca no arquivo original. */
export async function exportChatToVault(
  app: App,
  chat: ChatData,
  quando: Date = new Date(),
  extensao = "md",
  /** Nome pronto, quando quem chama tem exigência própria — é o caso do
   *  compartilhamento, que precisa de um nome legível por regex de URL. */
  nomeForcado?: string
): Promise<string> {
  await ensureFolder(app.vault.adapter, EXPORTS_FOLDER);
  let caminho = `${EXPORTS_FOLDER}/${
    nomeForcado ?? exportFileName(chat.title, quando, extensao)
  }`;
  // Dois exports da mesma conversa no mesmo dia não se sobrescrevem: a
  // segunda cópia pode ter mais conversa que a primeira.
  // Teto de tentativas: `exists` é uma resposta de fora, e um laço que só sai
  // quando ela disser "não" fica à mercê dela. Um adapter que responde `true`
  // sempre (o do preview respondia) travava o app inteiro — e num aparelho
  // isso é o app morto sem mensagem nenhuma.
  for (let n = 2; n <= 50 && (await app.vault.adapter.exists(caminho)); n++) {
    caminho = nomeForcado
      ? `${EXPORTS_FOLDER}/${nomeForcado.replace(
          /\.([^.]+)$/,
          `-${n}.$1`
        )}`
      : `${EXPORTS_FOLDER}/${exportFileName(
          `${chat.title} ${n}`,
          quando,
          extensao
        )}`;
  }
  await app.vault.adapter.write(caminho, exportChatMarkdown(chat, quando));
  return caminho;
}
