// src/agent/undo.ts
// O DESFAZER das mudanças do agente: antes de cada tool que mexe no vault, o
// executor guarda o que for preciso pra voltar atrás; depois que ela deu
// certo, registra aqui o "como desfazer". A conversa mostra um Undo em cada
// mudança (e um pra rodada inteira) enquanto a sessão estiver aberta.
//
// Na MEMÓRIA, e não em disco: guardar cópia de nota em arquivo é guardar
// conteúdo do vault num segundo lugar, que sincroniza, ocupa espaço e vaza.
// Fechou o Obsidian, o desfazer vai junto — a lixeira e o histórico de
// arquivos do próprio Obsidian continuam lá pra isso.
//
// Desfazer NUNCA atropela o que veio depois: se a nota mudou desde a mudança
// do agente (a pessoa editou, outro plugin escreveu), a volta para e pergunta
// (ConflitoAoDesfazer) — passar por cima é escolha de quem lê o aviso.

import { TFile, TFolder, type App, type TAbstractFile } from "obsidian";

/** A mudança é mais nova que a do agente: desfazer agora apagaria isso. */
export class ConflitoAoDesfazer extends Error {}

/** Como voltar uma mudança do agente. */
export interface Desfazer {
  /** Volta a mudança e diz o que fez ("Restored notes/a.md"). `forcar` passa
   *  por cima do que mudou depois; sem ele, isso vira ConflitoAoDesfazer. */
  executar(forcar?: boolean): Promise<string>;
}

/** O que se guarda ANTES da tool rodar. */
type Antes =
  | { tool: "vault_create"; path: string }
  | { tool: "vault_edit"; path: string; conteudo: string }
  | { tool: "vault_move"; from: string; to: string }
  | { tool: "vault_delete"; path: string; pasta: true }
  | { tool: "vault_delete"; path: string; pasta: false; bytes: ArrayBuffer }
  | { tool: "vault_create_folder"; path: string };

/** Acima disto, apagar não guarda cópia (e o Undo não aparece). */
const MAX_COPIA_BYTES = 20 * 1024 * 1024;

/** Os mesmos cortes do sandbox das tools: barras, bordas, `\`. O caminho já
 *  passou pela checagem de lá — aqui é só pra achar o mesmo arquivo. */
function limpo(p: unknown): string {
  return (typeof p === "string" ? p : "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function pai(p: string): string {
  return p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
}

async function garantirPasta(app: App, pasta: string): Promise<void> {
  if (!pasta || app.vault.getAbstractFileByPath(pasta)) return;
  await garantirPasta(app, pai(pasta));
  await app.vault.createFolder(pasta);
}

/**
 * O que o Obsidian faz com o que se apaga — a preferência "Deleted files":
 * "system" (lixeira do sistema), "local" (a pasta .trash do vault) ou "none"
 * (apagar de vez). A API pública não expõe a leitura; `getConfig` é o mesmo
 * que o próprio app usa, e sem ele vale a hipótese que pede confirmação.
 */
export function lixeiraDoVault(app: App): "system" | "local" | "none" | null {
  const vault = app.vault as unknown as { getConfig?: (k: string) => unknown };
  try {
    const v = vault.getConfig?.("trashOption");
    return v === "system" || v === "local" || v === "none" ? v : null;
  } catch {
    return null;
  }
}

/** Apagar vai pra ALGUMA lixeira (dá pra recuperar fora do app também)? */
export function apagarVaiPraLixeira(app: App): boolean {
  const l = lixeiraDoVault(app);
  return l === "system" || l === "local";
}

/**
 * Antes da tool: guarda o estado que ela vai mudar. null = a tool não muda o
 * vault (ler, listar, buscar) ou não dá pra guardar (arquivo grande demais).
 */
export async function antesDe(
  app: App,
  name: string,
  args: Record<string, unknown>
): Promise<Antes | null> {
  switch (name) {
    case "vault_create":
      return { tool: name, path: limpo(args.path) };
    case "vault_edit": {
      const path = limpo(args.path);
      const f = app.vault.getAbstractFileByPath(path);
      if (!(f instanceof TFile)) return null;
      return { tool: name, path, conteudo: await app.vault.read(f) };
    }
    case "vault_move":
      return { tool: name, from: limpo(args.from), to: limpo(args.to) };
    case "vault_delete": {
      const path = limpo(args.path);
      const f = app.vault.getAbstractFileByPath(path);
      if (f instanceof TFolder) return { tool: name, path, pasta: true };
      if (!(f instanceof TFile)) return null;
      if ((f.stat?.size ?? 0) > MAX_COPIA_BYTES) return null;
      // Os BYTES, não o texto: apagar também pega imagem e PDF, e até numa
      // nota a cópia byte a byte volta exatamente o que estava lá.
      return { tool: name, path, pasta: false, bytes: await app.vault.readBinary(f) };
    }
    case "vault_create_folder": {
      const path = limpo(args.path);
      // Já existia: a tool não fez nada, e não há o que desfazer.
      if (app.vault.getAbstractFileByPath(path)) return null;
      return { tool: name, path };
    }
    default:
      return null;
  }
}

/** O texto atual de um arquivo do vault, ou null se ele não existe mais. */
async function textoDe(app: App, path: string): Promise<{ f: TFile; texto: string } | null> {
  const f = app.vault.getAbstractFileByPath(path);
  if (!(f instanceof TFile)) return null;
  return { f, texto: await app.vault.read(f) };
}

/**
 * Depois que a tool deu certo: monta o desfazer a partir do que foi guardado
 * antes e do estado logo depois (que é o que a volta confere pra saber se
 * alguém mexeu no meio).
 */
export async function depoisDe(app: App, antes: Antes): Promise<Desfazer | null> {
  switch (antes.tool) {
    case "vault_create": {
      const agora = await textoDe(app, antes.path);
      if (!agora) return null;
      const escrito = agora.texto;
      return {
        async executar(forcar) {
          const atual = await textoDe(app, antes.path);
          if (!atual) throw new Error(`${antes.path} no longer exists.`);
          if (atual.texto !== escrito && !forcar) {
            throw new ConflitoAoDesfazer(`${antes.path} changed after the agent created it.`);
          }
          await app.fileManager.trashFile(atual.f);
          return `Removed ${antes.path}`;
        },
      };
    }
    case "vault_edit": {
      const agora = await textoDe(app, antes.path);
      if (!agora) return null;
      const escrito = agora.texto;
      return {
        async executar(forcar) {
          const atual = await textoDe(app, antes.path);
          if (!atual) throw new Error(`${antes.path} no longer exists.`);
          if (atual.texto !== escrito && !forcar) {
            throw new ConflitoAoDesfazer(`${antes.path} changed after the agent's edit.`);
          }
          await app.vault.process(atual.f, () => antes.conteudo);
          return `Restored ${antes.path}`;
        },
      };
    }
    case "vault_move":
      return {
        async executar() {
          const alvo: TAbstractFile | null = app.vault.getAbstractFileByPath(antes.to);
          if (!alvo) throw new Error(`Nothing at ${antes.to} anymore.`);
          if (app.vault.getAbstractFileByPath(antes.from)) {
            throw new Error(`${antes.from} is taken now — move it by hand.`);
          }
          await garantirPasta(app, pai(antes.from));
          // O mesmo caminho da tool: reescreve os [[links]] de volta.
          await app.fileManager.renameFile(alvo, antes.from);
          return `Moved back to ${antes.from}`;
        },
      };
    case "vault_delete":
      return {
        async executar() {
          if (app.vault.getAbstractFileByPath(antes.path)) {
            throw new Error(`${antes.path} exists again — nothing to restore over.`);
          }
          await garantirPasta(app, pai(antes.path));
          if (antes.pasta) {
            await app.vault.createFolder(antes.path);
          } else {
            await app.vault.createBinary(antes.path, antes.bytes);
          }
          return `Restored ${antes.path}`;
        },
      };
    case "vault_create_folder":
      return {
        async executar() {
          const d = app.vault.getAbstractFileByPath(antes.path);
          if (!(d instanceof TFolder)) throw new Error(`${antes.path} no longer exists.`);
          // Pasta com coisa dentro não sai nem forçando: o que entrou nela
          // depois não é do agente.
          if (d.children.length > 0) throw new Error(`${antes.path} has files in it now.`);
          await app.fileManager.trashFile(d);
          return `Removed folder ${antes.path}`;
        },
      };
  }
}

// ── O registro ────────────────────────────────────────────────────────────
// Por id da linha de atividade da mudança (a mensagem da conversa): é o que a
// tela tem na mão quando a pessoa toca no Undo.

const registro = new Map<string, Desfazer>();

export function registrarDesfazer(id: string, d: Desfazer): void {
  registro.set(id, d);
}

/** Esta mudança ainda pode ser desfeita (nesta sessão)? */
export function podeDesfazer(id: string | undefined): boolean {
  return !!id && registro.has(id);
}

/**
 * Desfaz uma mudança. Deu certo: sai do registro (não se desfaz duas vezes).
 * Conflito: fica, pra a pessoa poder confirmar e forçar.
 */
export async function desfazer(id: string, forcar = false): Promise<string> {
  const d = registro.get(id);
  if (!d) throw new Error("This change can no longer be undone.");
  const feito = await d.executar(forcar);
  registro.delete(id);
  return feito;
}

/** Esquece tudo (o plugin descarregou). */
export function esquecerDesfazeres(): void {
  registro.clear();
}
