// src/assistant/store.ts
// A assistente CONTINUA respondendo depois que você sai.
//
// Antes, a rodada vivia dentro do painel: o estado era `useState` lá dentro, e
// fechar o painel — ou a folha, ou trocar de nível — desmontava o componente e
// a resposta chegava num lugar que não existia mais. Num modelo free, uma volta
// leva de cinco a vinte segundos; ficar olhando um botão escrito "Writing…" por
// vinte segundos é tempo demais pra pedir de alguém, e qualquer toque fora
// perdia o pedido.
//
// Aqui a rodada mora FORA da árvore do React. O componente só olha. Sair não
// cancela nada: a chamada segue, o resultado espera, e quem voltar — o mesmo
// painel ou o formulário sozinho — encontra o rascunho pronto.
//
// A chave é o QUE está sendo escrito ("skill", "project", "description",
// "instructions"), não quem pediu. Duas rodadas do mesmo tipo ao mesmo tempo
// seriam duas respostas disputando os mesmos campos; a segunda substitui a
// primeira, e é o que qualquer um espera de tocar "escreve de novo".

import type { TurnoAssistente } from "./run";
import { tr } from "../i18n/tr";

export type FaseRun =
  | "parada"
  | "rodando"
  | "perguntando"
  | "pronto"
  | "erro";

export interface Run {
  fase: FaseRun;
  /** A conversa até aqui — sobrevive ao painel fechar. */
  turnos: TurnoAssistente[];
  /** Modo guiado: a pergunta da vez e as opções pra tocar. */
  pergunta: string;
  opcoes: string[];
  /** O que veio pronto, esperando quem aplique. `unknown` porque o store não
   *  conhece os formatos — quem pediu sabe o que pediu. */
  resultado: unknown;
  erro: string;
  /** Quando esta rodada começou — o relógio da espera sai daqui, e ele
   *  sobrevive ao painel fechar junto com o resto. */
  inicio: number;
}

const PARADA: Run = {
  fase: "parada",
  turnos: [],
  pergunta: "",
  opcoes: [],
  resultado: null,
  erro: "",
  inicio: 0,
};

const runs = new Map<string, Run>();
const ouvintes = new Map<string, Set<() => void>>();

function avisar(chave: string): void {
  for (const f of ouvintes.get(chave) ?? []) f();
}

export function lerRun(chave: string): Run {
  return runs.get(chave) ?? PARADA;
}

export function assinar(chave: string, ouvinte: () => void): () => void {
  const set = ouvintes.get(chave) ?? new Set();
  set.add(ouvinte);
  ouvintes.set(chave, set);
  return () => set.delete(ouvinte);
}

function por(chave: string, mudanca: Partial<Run>): void {
  runs.set(chave, { ...lerRun(chave), ...mudanca });
  avisar(chave);
}

/** O que uma rodada devolve — o mesmo formato do hook que fala com o modelo. */
export interface Rodada {
  pergunta?: string;
  opcoes?: string[];
  erro?: string;
  draft?: unknown;
}

/**
 * Dispara uma rodada e guarda o que voltar.
 *
 * Não devolve promessa de propósito: quem chama não deve esperar. O resultado
 * chega pelo store, e é o store que quem estiver na tela está olhando.
 *
 * `aoTerminar` é o aviso pra quem ficou fora — o Notice de "ficou pronto"
 * quando o painel já tinha sido fechado. Ele NÃO aplica nada: aplicar é do
 * formulário, que é quem sabe onde o texto vai.
 */
export function comecarRodada(
  chave: string,
  turnos: TurnoAssistente[],
  chamar: (turnos: TurnoAssistente[]) => Promise<Rodada>,
  aoTerminar?: (r: Run) => void
): void {
  por(chave, {
    fase: "rodando",
    inicio: Date.now(),
    turnos,
    pergunta: "",
    opcoes: [],
    erro: "",
    resultado: null,
  });
  void chamar(turnos)
    .then((r) => {
      if (r.erro) {
        por(chave, { fase: "erro", erro: r.erro });
      } else if (r.pergunta) {
        // A pergunta dela entra na conversa: sem isso, na rodada seguinte o
        // modelo não sabe o que perguntou e repete.
        por(chave, {
          fase: "perguntando",
          pergunta: r.pergunta,
          opcoes: r.opcoes ?? [],
          turnos: [...turnos, { quem: "assistente", texto: r.pergunta }],
        });
      } else {
        por(chave, { fase: "pronto", resultado: r.draft ?? null });
      }
      aoTerminar?.(lerRun(chave));
    })
    .catch((e: unknown) => {
      // `chamar` já devolve erro em vez de lançar, mas um throw solto aqui
      // deixaria a rodada travada em "rodando" pra sempre — e a tela com um
      // botão escrito "Writing…" que nunca volta.
      por(chave, {
        fase: "erro",
        erro: (e as Error)?.message || tr("The assistant could not answer."),
      });
      aoTerminar?.(lerRun(chave));
    });
}

/** Zera a rodada — depois de aplicar o resultado, ou ao desistir. */
export function limparRun(chave: string): void {
  runs.delete(chave);
  avisar(chave);
}

/** Só pros testes: esquece tudo entre um caso e outro. */
export function _resetRuns(): void {
  runs.clear();
  ouvintes.clear();
}
