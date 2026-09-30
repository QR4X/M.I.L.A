// src/ui/Markdown.tsx
// Renderiza markdown com o renderer NATIVO do Obsidian (wikilinks, callouts,
// code, mermaid…) — INCLUSIVE enquanto a mensagem está chegando.
//
// Antes o streaming mostrava texto cru e só formatava no fim, pra fugir de dois
// problemas reais: custo (re-parsear a cada token) e piscada (esvaziar o nó
// antes de cada render). Os dois têm solução, e nenhuma delas é desistir da
// formatação:
//
//   custo   → no máximo um render a cada THROTTLE_MS, com o texto mais novo
//             no momento em que ele acontece (não uma fila deles).
//   piscada → o markdown é montado num nó SOLTO e só então troca o conteúdo
//             visível de uma vez. O usuário nunca vê o vazio do meio.

import { useCallback, useEffect, useRef } from "react";
import { App, Component, MarkdownRenderer } from "obsidian";

/** Teto de renders por segundo enquanto o texto chega. */
const THROTTLE_MS = 140;

export function Markdown({
  app,
  text,
  streaming,
}: {
  app: App;
  text: string;
  streaming?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const compRef = useRef<Component | null>(null);
  const timerRef = useRef<number | null>(null);
  /** Texto mais novo — o timer lê daqui, não do fecho em que foi criado. */
  const textRef = useRef(text);
  textRef.current = text;
  /** O que já está na tela: evita re-render de texto que não mudou. */
  const shownRef = useRef<string | null>(null);

  const render = useCallback(
    async (md: string) => {
      const el = ref.current;
      if (!el) return;
      shownRef.current = md;
      compRef.current?.unload();
      const comp = new Component();
      comp.load();
      compRef.current = comp;
      // Monta FORA da tela e troca pronto: sem o quadro vazio do meio.
      // No documento do PRÓPRIO destino: numa janela destacada, um nó criado
      // na janela principal entra como estrangeiro.
      //
      // O lint do Obsidian pede `el.ownerDocument.win.createDiv()` aqui. NÃO
      // usamos, e a razão foi apurada (0.9.9): `createDiv` não está declarado
      // em `Window` na tipagem oficial — só como função global solta — e o
      // app.js do próprio Obsidian não chama `.win.createDiv(` uma única vez.
      // É sugestão da regra, não API firmada. O que está em jogo aqui é o
      // markdown de TODA resposta do chat: se a função não existir na janela,
      // nada renderiza. `createElement` faz o que precisamos (nó solto, no
      // documento certo) e é DOM padrão. Fica, com o aviso.
      const tmp = el.ownerDocument.createElement("div");
      await MarkdownRenderer.render(app, md, tmp, "", comp);
      if (ref.current !== el || shownRef.current !== md) return;
      el.replaceChildren(...Array.from(tmp.childNodes));
    },
    [app]
  );

  useEffect(() => {
    if (!streaming) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (shownRef.current !== text) void render(text);
      return;
    }
    // Já tem um render agendado: ele vai pegar o texto mais novo sozinho.
    if (timerRef.current !== null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void render(textRef.current);
    }, THROTTLE_MS);
  }, [text, streaming, render]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      compRef.current?.unload();
    },
    []
  );

  return <div ref={ref} className="axxa-markdown" />;
}
