// src/ui/menu.ts
// O menu de AÇÕES — o que abre no ⋯ de uma conversa, de um projeto, de um
// skill.
//
// Era o `Menu` do Obsidian. No celular ele sobe como folha colada na base da
// tela, e aí o menu de um item que está no TOPO da lista aparece a quinze
// centímetros dele, embaixo de tudo: você toca em cima, olha em cima, e a
// resposta acontece embaixo. Num aparelho de 6 polegadas isso é perder o fio
// da ação — e com quatro conversas na tela, nada diz de qual delas é o menu.
//
// Aqui ele é um balão ancorado NO BOTÃO: desce logo abaixo dele, alinhado à
// direita, e sobe pra cima quando não há espaço embaixo. A origem do menu é a
// origem do toque, que é a única coisa que ele precisa dizer.
//
// Ele tem DOIS níveis quando precisa (escolher um projeto, por exemplo), e o
// segundo acontece no mesmo balão, no mesmo lugar: a escolha continua ancorada
// no item de onde ela saiu. Folha por cima do menu seria a terceira camada
// empilhada pra decidir uma coisa só.
//
// Imperativo de propósito: ele é chamado de dentro de `onClick` em cinco telas
// diferentes, e virar estado de React em todas elas seria cinco `useState`
// para uma coisa que vive 400ms.

import { setIcon } from "obsidian";
import { screen } from "./haptics";

/** Menu de ações (⋯ de um chat, de um projeto). */
export interface MenuAction {
  label: string;
  icon?: string;
  /** Cor própria do item (a de um projeto). Com ela, o ícone vira BRASÃO: o
   *  mesmo quadrado squircle da lista de projetos, no tom dele. Um menu de
   *  projetos com ícones cinzas perde justamente o que faz um projeto ser
   *  reconhecido de relance. */
  color?: string;
  danger?: boolean;
  /** Opção ATUAL de uma escolha (o filtro de período da home do Agent). */
  checked?: boolean;
  /** Abre um SEGUNDO nível no mesmo balão. Com `children`, o `run` não roda:
   *  quem tem filhos navega. */
  children?: MenuAction[];
  run?: () => void;
}

/** O que basta pra achar a âncora: o alvo do clique e onde ele foi. */
export interface MenuEvent {
  clientX?: number;
  clientY?: number;
  currentTarget?: EventTarget | null;
}

/** Respiro entre o botão e o balão, e entre o balão e a beirada da tela. */
const VAO = 6;
const MARGEM = 10;

export function openActions(ev: MenuEvent, actions: MenuAction[]): void {
  if (actions.length === 0) return;
  const raiz =
    (document.querySelector(".axxa-root") as HTMLElement | null) ??
    document.body;

  const camada = document.createElement("div");
  camada.className = "axxa-pop-layer";

  const balao = document.createElement("div");
  balao.className = "axxa-pop";
  balao.setAttribute("role", "menu");

  // O elemento âncora é guardado AGORA: `currentTarget` de um evento do React
  // é zerado quando o handler termina, e o segundo nível do menu se
  // reposiciona depois disso — sem esta cópia, ele perdia o botão e caía no
  // ponto do toque.
  const ancoraEl = (ev.currentTarget as HTMLElement | null) ?? null;

  let fechar = () => {};

  const item = (a: MenuAction, aoTocar: () => void): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = a.danger ? "axxa-pop-item is-danger" : "axxa-pop-item";
    b.setAttribute("role", "menuitem");
    if (a.icon) {
      const ico = document.createElement("span");
      // Com cor, o ícone ganha a MESMA plaquinha da lista de projetos
      // (`axxa-thing-mark`): mesma forma, mesmo jeito de tingir — o fundo sai
      // do `currentColor`. Reusar a classe é o que garante que as duas telas
      // não comecem a divergir na terceira mudança.
      ico.className = a.color
        ? "axxa-pop-ico axxa-thing-mark"
        : "axxa-pop-ico";
      if (a.color) ico.style.color = a.color;
      // O mesmo `setIcon` do resto do app (ver Icon.tsx): o set de ícones é o
      // do Obsidian, então o menu não traz um segundo vocabulário de desenho.
      setIcon(ico, a.icon);
      b.appendChild(ico);
    }
    const txt = document.createElement("span");
    txt.className = "axxa-pop-label";
    txt.textContent = a.label;
    b.appendChild(txt);
    if (a.checked) {
      const marca = document.createElement("span");
      marca.className = "axxa-pop-check";
      setIcon(marca, "check");
      b.appendChild(marca);
    }
    if (a.children) {
      const chev = document.createElement("span");
      chev.className = "axxa-pop-chev";
      setIcon(chev, "chevron-right");
      b.appendChild(chev);
    }
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      aoTocar();
    });
    return b;
  };

  /** Redesenha o balão num nível. `voltar` existe do segundo em diante. */
  const desenhar = (itens: MenuAction[], voltar: (() => void) | null): void => {
    while (balao.firstChild) balao.removeChild(balao.firstChild);
    if (voltar) {
      const volta = item({ label: "Back", icon: "chevron-left" }, voltar);
      volta.classList.add("is-back");
      balao.appendChild(volta);
    }
    for (const a of itens) {
      balao.appendChild(
        item(a, () => {
          if (a.children) {
            desenhar(a.children, () => desenhar(itens, voltar));
            return;
          }
          fechar();
          a.run?.();
        })
      );
    }
    posicionar();
  };

  camada.appendChild(balao);
  raiz.appendChild(camada);

  /**
   * Onde ele pousa. Medido DEPOIS de estar na árvore — antes disso o balão não
   * tem tamanho, e posição calculada com tamanho zero é chute. Roda de novo a
   * cada nível: o segundo tem outra altura, e um balão ancorado só pelo topo
   * cresceria pra dentro da barra de baixo.
   */
  function posicionar(): void {
    const r = ancoraEl?.getBoundingClientRect?.();
    const base = raiz.getBoundingClientRect();
    // `offsetWidth/Height`, e não o retângulo: o balão nasce com `scale(0.94)`
    // pra crescer, e o retângulo mede o TRANSFORMADO — a conta saía 6% menor e
    // ele pousava 10px pra fora da borda do botão.
    const bal = { width: balao.offsetWidth, height: balao.offsetHeight };

    const ancora = r ?? {
      left: (ev.clientX ?? 0) - 1,
      right: (ev.clientX ?? 0) + 1,
      top: (ev.clientY ?? 0) - 1,
      bottom: (ev.clientY ?? 0) + 1,
    };

    // Alinhado à DIREITA do botão: o ⋯ mora na ponta direita das listas, e um
    // balão que abre pra dentro segue a leitura em vez de cruzá-la.
    let x = ancora.right - base.left - bal.width;
    x = Math.min(Math.max(x, MARGEM), base.width - bal.width - MARGEM);

    let y = ancora.bottom - base.top + VAO;
    // Sem espaço embaixo, ele sobe: melhor cobrir o que está acima do botão do
    // que nascer fora da tela.
    if (y + bal.height > base.height - MARGEM) {
      y = ancora.top - base.top - bal.height - VAO;
    }
    y = Math.max(y, MARGEM);

    balao.style.left = `${Math.round(x)}px`;
    balao.style.top = `${Math.round(y)}px`;
    // A âncora também é o ponto de origem da animação: ele cresce de onde foi
    // tocado.
    balao.style.transformOrigin =
      y > ancora.top - base.top ? "top right" : "bottom right";
  }

  desenhar(actions, null);
  camada.classList.add("is-open");
  screen();

  // ── como ele sai ──────────────────────────────────────────────────────
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      fechar();
    }
  };
  fechar = () => {
    document.removeEventListener("keydown", onKey);
    camada.remove();
  };
  camada.addEventListener("click", fechar);
  document.addEventListener("keydown", onKey);
  // Rolou a lista atrás: o balão perde a âncora e some, em vez de ficar
  // pairando sobre outro item.
  raiz.addEventListener("scroll", fechar, { capture: true, once: true });
}
