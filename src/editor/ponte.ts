// src/editor/ponte.ts
// A PONTE entre o editor (comandos, menus de clique direito — que moram no
// plugin) e o painel (o React, que mora na view). Um comando como "Ask about
// this note" pode rodar com o painel FECHADO: ele abre a view, e o pedido
// tem que esperar o painel montar. Por isso a fila: pedido sem ninguém
// ouvindo fica guardado, e o painel, ao montar, esvazia a fila.

/** O que o editor pede ao painel. */
export type PedidoDoEditor =
  /** Uma conversa nova com a nota anexada; com `enviar`, já manda a pergunta. */
  | { tipo: "nota"; path: string; enviar?: string }
  /** Um trecho selecionado vai pra conversa aberta, como anexo. */
  | { tipo: "trecho"; path: string; texto: string };

type Ouvinte = (p: PedidoDoEditor) => void;

let ouvinte: Ouvinte | null = null;
const fila: PedidoDoEditor[] = [];

/** O editor pede. Sem painel montado, o pedido espera na fila. */
export function pedirAoPainel(p: PedidoDoEditor): void {
  if (ouvinte) ouvinte(p);
  else fila.push(p);
}

/** O painel passa a ouvir — e recebe o que esperava. Devolve o "parar". */
export function ouvirPedidos(fn: Ouvinte): () => void {
  ouvinte = fn;
  while (fila.length > 0) fn(fila.shift() as PedidoDoEditor);
  return () => {
    if (ouvinte === fn) ouvinte = null;
  };
}

/** O plugin descarregou: nada fica pendurado. */
export function esquecerPedidos(): void {
  ouvinte = null;
  fila.length = 0;
}
