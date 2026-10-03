// src/ui/agentUndo.ts
// O lado da TELA do desfazer do agente (o motor mora em agent/undo.ts): quais
// ações de uma rodada ainda dá pra desfazer, e os dois jeitos de desfazer —
// uma mudança (da folha de ações) ou a rodada inteira (o chip da resposta).
//
// A rodada volta de trás pra frente: a última mudança primeiro. É a única
// ordem que funciona quando uma depende da outra (criou e depois editou a
// mesma nota; moveu e depois editou no lugar novo).

import { Notice, type App } from "obsidian";
import { ConflitoAoDesfazer, desfazer, podeDesfazer } from "../agent/undo";
import { useChatStore, type ActivityMeta } from "../store/chat";
import { ConfirmModal } from "./modals";

/** O id de desfazer de uma ação que AINDA pode ser desfeita, ou null. */
export function idDesfazivel(a: ActivityMeta | undefined): string | null {
  if (!a || a.undone || a.phase !== "done") return null;
  return podeDesfazer(a.undoId) ? (a.undoId as string) : null;
}

/** As ações desfazíveis de uma lista, na ordem em que aconteceram. */
export function desfaziveis(atividades: Array<ActivityMeta | undefined>): string[] {
  return atividades.map(idDesfazivel).filter((id): id is string => id !== null);
}

function mensagem(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Desfaz UMA mudança. Se o arquivo mudou depois dela, pergunta antes de
 * passar por cima. Devolve true se desfez.
 */
export async function desfazerUma(app: App, id: string): Promise<boolean> {
  try {
    const feito = await desfazer(id);
    useChatStore.getState().markUndone(id);
    new Notice(feito);
    return true;
  } catch (err) {
    if (!(err instanceof ConflitoAoDesfazer)) {
      new Notice(`Could not undo: ${mensagem(err)}`);
      return false;
    }
    const ok = await new ConfirmModal(app, {
      title: "Undo anyway?",
      body: `${err.message} Undoing now throws away what changed since.`,
      confirmLabel: "Undo anyway",
      danger: true,
    }).openAndWait();
    if (!ok) return false;
    try {
      const feito = await desfazer(id, true);
      useChatStore.getState().markUndone(id);
      new Notice(feito);
      return true;
    } catch (err2) {
      new Notice(`Could not undo: ${mensagem(err2)}`);
      return false;
    }
  }
}

/**
 * Desfaz a rodada inteira, da última mudança pra primeira, depois de uma
 * confirmação. O que mudou depois da mudança do agente NÃO é atropelado
 * aqui: fica de fora, e o aviso diz que dá pra forçar pela folha de ações.
 */
export async function desfazerRodada(app: App, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const ok = await new ConfirmModal(app, {
    title: ids.length === 1 ? "Undo the agent's change?" : `Undo the agent's ${ids.length} changes?`,
    body: "Notes go back to how they were before this turn. Anything you changed by hand since is kept.",
    confirmLabel: "Undo",
  }).openAndWait();
  if (!ok) return;
  let feitas = 0;
  let puladas = 0;
  const falhas: string[] = [];
  for (const id of [...ids].reverse()) {
    try {
      await desfazer(id);
      useChatStore.getState().markUndone(id);
      feitas++;
    } catch (err) {
      if (err instanceof ConflitoAoDesfazer) puladas++;
      else falhas.push(mensagem(err));
    }
  }
  const partes = [feitas === 1 ? "1 change undone" : `${feitas} changes undone`];
  if (puladas > 0) {
    partes.push(
      `${puladas} kept because the note changed since (undo ${puladas === 1 ? "it" : "them"} from the action list to force)`
    );
  }
  if (falhas.length > 0) partes.push(`${falhas.length} failed: ${falhas[0]}`);
  new Notice(partes.join(" · "), falhas.length || puladas ? 8000 : 4000);
}
