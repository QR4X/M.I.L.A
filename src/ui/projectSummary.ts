// src/ui/projectSummary.ts
// O que o cartão de um projeto conta sobre ele. Função pura, fora da
// ProjectsView, pra poder ser testada sem montar a folha inteira (e as classes
// do Obsidian que vêm junto).

import type { Project } from "../projects";
import { relativeShort } from "./modules";

/**
 * O que o CARTÃO de um projeto conta sobre ele, em três perguntas:
 *
 * · está VIVO? — quando foi a última conversa nele (ou quando ele nasceu,
 *   se ainda não teve nenhuma). Curto ("2d ago"), porque mora na linha do
 *   título, ao lado do nome — o mesmo formato da lista de conversas;
 * · do que ele TRATA? — a primeira linha das instruções, que é a frase que a
 *   pessoa escreveu sobre ele; sem instruções, o título da conversa mais
 *   recente, que é a melhor pista seguinte; sem as duas, nada (o cartão
 *   mostra uma dica);
 * · quanto ele JÁ TEM? — notas e conversas.
 *
 * As conversas contam só as que EXISTEM: `chatIds` guarda id de conversa
 * apagada também, e um "3 chats" que abre em dois seria o cartão mentindo.
 */
export function resumoDoProjeto(
  p: Project,
  chats: readonly { id: string; title: string; date: string }[],
  agora: number = Date.now()
): { quando: string; sobre: string | null; conversas: number } {
  const ids = new Set(p.chatIds);
  const deles = chats
    .filter((c) => ids.has(c.id))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const ultima = deles[0];
  const tempo = (iso: string) => {
    const r = relativeShort(iso, agora);
    if (!r) return "";
    if (r === "now") return "just now";
    // "3d", "5h", "12m" viram "3d ago"; data inteira (mais de um mês) fica
    // como está — "ago" depois de uma data não é português nem inglês.
    return /^\d+[mhd]$/.test(r) ? `${r} ago` : r;
  };
  const quando = tempo(ultima ? ultima.date : p.createdAt);
  const primeira = (p.instructions ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  const sobre =
    primeira ?? (ultima?.title.trim() ? `Latest: ${ultima.title.trim()}` : null);
  return { quando, sobre, conversas: deles.length };
}
