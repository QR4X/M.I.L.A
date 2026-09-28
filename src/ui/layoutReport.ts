// src/ui/layoutReport.ts
// "Inspector": relatório do layout mobile, copiado pro clipboard pelo comando
// "Copy mobile layout report".
//
// Existe porque os dois problemas difíceis desta casca — a gaveta com o
// teclado e a tela cheia — dependem de números que só o APARELHO conhece:
// se a WebView encolhe sozinha, se o Obsidian publica `--keyboard-height`,
// onde o safe-area já foi aplicado, quem pinta a faixa de baixo. Adivinhar
// isso pelo print custa uma release por tentativa; o relatório resolve numa.

const PROBE_ID = "axxa-safe-area-probe";

/** Lê os `env(safe-area-inset-*)` de verdade — não dá pra ler direto do JS. */
function readEnvInsets(doc: Document): Record<string, string> {
  let probe = doc.getElementById(PROBE_ID);
  if (!probe) {
    probe = doc.createElement("div");
    probe.id = PROBE_ID;
    probe.style.position = "fixed";
    probe.style.visibility = "hidden";
    probe.style.pointerEvents = "none";
    probe.style.paddingTop = "env(safe-area-inset-top, 0px)";
    probe.style.paddingRight = "env(safe-area-inset-right, 0px)";
    probe.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
    probe.style.paddingLeft = "env(safe-area-inset-left, 0px)";
    doc.body.appendChild(probe);
  }
  const cs = doc.defaultView?.getComputedStyle(probe);
  const out = {
    top: cs?.paddingTop ?? "?",
    right: cs?.paddingRight ?? "?",
    bottom: cs?.paddingBottom ?? "?",
    left: cs?.paddingLeft ?? "?",
  };
  probe.remove();
  return out;
}

function rect(el: Element | null | undefined): string {
  if (!el) return "ausente";
  const b = el.getBoundingClientRect();
  return `x=${Math.round(b.x)} y=${Math.round(b.y)} w=${Math.round(
    b.width
  )} h=${Math.round(b.height)} bottom=${Math.round(b.bottom)}`;
}

function bg(el: Element | null | undefined, win: Window | null): string {
  if (!el || !win) return "?";
  return win.getComputedStyle(el).backgroundColor;
}

/** Caixa com o que decide a COLUNA: posição, altura e as folgas de baixo.
 *  A geometria sozinha não diz por que um item foi parar onde foi. */
function caixa(el: Element | null | undefined, win: Window | null): string {
  if (!el || !win) return "ausente";
  const cs = win.getComputedStyle(el);
  return (
    `${rect(el)}  pos=${cs.position} flex=${cs.flex} ` +
    `mb=${cs.marginBottom} pb=${cs.paddingBottom} h=${cs.height}`
  );
}

/**
 * Monta o relatório a partir do container da view. `containerEl` é o da
 * ItemView — daí se alcança a gaveta, o body e o documento.
 */
export function buildLayoutReport(containerEl: HTMLElement): string {
  const doc = containerEl.ownerDocument;
  const win = doc.defaultView;
  const vv = win?.visualViewport ?? null;
  const docEl = doc.documentElement;
  const body = doc.body;
  const drawer = containerEl.closest(".workspace-drawer");
  const cssVar = (name: string) =>
    (win?.getComputedStyle(docEl).getPropertyValue(name) || "").trim() || "—";

  const covered =
    vv && win ? Math.round(win.innerHeight - (vv.height + vv.offsetTop)) : 0;
  const env = readEnvInsets(doc);

  const lines = [
    "AXXA · mobile layout report",
    new Date().toISOString(),
    "",
    "[janela]",
    `  innerWidth/Height ....... ${win?.innerWidth} x ${win?.innerHeight}`,
    `  screen .................. ${win?.screen.width} x ${win?.screen.height}`,
    `  devicePixelRatio ........ ${win?.devicePixelRatio}`,
    `  visualViewport .......... ${
      vv
        ? `h=${Math.round(vv.height)} offsetTop=${Math.round(
            vv.offsetTop
          )} scale=${vv.scale}`
        : "indisponível"
    }`,
    `  coberto (teclado?) ...... ${covered}px`,
    "",
    "[variáveis]",
    `  --keyboard-height (inline no <html>) .. ${
      docEl.style.getPropertyValue("--keyboard-height") || "não setada"
    }`,
    `  --keyboard-height (computada) ......... ${cssVar("--keyboard-height")}`,
    `  --safe-area-inset-top/bottom .......... ${cssVar(
      "--safe-area-inset-top"
    )} / ${cssVar("--safe-area-inset-bottom")}`,
    `  env(safe-area-inset-*) t/r/b/l ........ ${env.top} / ${env.right} / ${env.bottom} / ${env.left}`,
    `  --navbar-height ....................... ${cssVar("--navbar-height")}`,
    "",
    "[classes]",
    `  body .................... ${body.className || "—"}`,
    `  gaveta .................. ${drawer?.className ?? "ausente"}`,
    "",
    "[geometria]  (bottom = distância do topo da tela)",
    `  gaveta .................. ${rect(drawer)}  bg=${bg(drawer, win)}`,
    `  tab-content ............. ${rect(
      doc.querySelector(".workspace-drawer-active-tab-content")
    )}`,
    `  leaf-content ............ ${rect(
      containerEl.querySelector(":scope") ? containerEl : null
    )}`,
    `  view-content ............ ${rect(
      containerEl.querySelector(".view-content") ??
        containerEl.children[1] ?? null
    )}`,
    `  .axxa-root .............. ${rect(
      containerEl.querySelector(".axxa-root")
    )}  bg=${bg(containerEl.querySelector(".axxa-root"), win)}`,
    `  .axxa-chat .............. ${caixa(
      containerEl.querySelector(".axxa-chat"),
      win
    )}`,
    `  .axxa-messages .......... ${caixa(
      containerEl.querySelector(".axxa-messages"),
      win
    )}`,
    `  .axxa-composer .......... ${caixa(
      containerEl.querySelector(".axxa-composer"),
      win
    )}`,
    `  .axxa-input (cartão) .... ${rect(
      containerEl.querySelector(".axxa-input")
    )}`,
    `  --axxa-composer-h ....... ${
      (containerEl.querySelector(".axxa-root") as HTMLElement | null)?.style.getPropertyValue(
        "--axxa-composer-h"
      ) || "não setada"
    }`,
    `  .mobile-navbar .......... ${rect(
      doc.querySelector(".mobile-navbar")
    )}  display=${
      win && doc.querySelector(".mobile-navbar")
        ? win.getComputedStyle(doc.querySelector(".mobile-navbar") as Element)
            .display
        : "—"
    }`,
    "",
    "[app]",
    `  .app-container .......... ${rect(
      doc.querySelector(".app-container")
    )}  bg=${bg(doc.querySelector(".app-container"), win)}`,
    `  body .................... bg=${bg(body, win)}`,
  ];
  return lines.join("\n");
}

// ── gravador do teclado ─────────────────────────────────────────────────────
//
// O relatório acima é UMA foto, e ela não serve pro bug do teclado: rodar um
// comando no celular abre a paleta, a paleta tira o foco do campo, e a foto sai
// com o estado errado. Pior — o que interessa não é um estado, é a DIFERENÇA
// entre dois (a barra de ferramentas do teclado aberta e fechada), porque foi
// ali que a folha andou ao contrário do composer e nenhum preview reproduziu.
//
// Então isto grava: liga, a pessoa volta pra tela, toca no campo, abre e fecha
// a barra do teclado, e a cada mudança de `--keyboard-height` sai uma linha com
// todas as bordas de baixo que importam. No fim, tudo vai pro clipboard de uma
// vez.

/** A cadeia de quem pode estar CONTENDO a folha: todo ancestral que muda o
 *  referencial de um filho `fixed`/`absolute` (posição, transform, contain,
 *  will-change, filter). Sai uma vez só, no começo — ela não muda com o
 *  teclado, e é justamente o que o preview não tem igual ao aparelho. */
function cadeiaDaFolha(layer: Element | null, win: Window): string[] {
  if (!layer) return ["  (nenhuma folha aberta no começo da gravação)"];
  const out: string[] = [];
  for (let el: Element | null = layer; el; el = el.parentElement) {
    const cs = win.getComputedStyle(el);
    const marca = [
      cs.position !== "static" ? `pos=${cs.position}` : "",
      cs.transform !== "none" ? `transform=${cs.transform}` : "",
      cs.contain && cs.contain !== "none" ? `contain=${cs.contain}` : "",
      /transform|filter|perspective/.test(cs.willChange) ? `will-change=${cs.willChange}` : "",
      cs.filter !== "none" ? `filter=${cs.filter}` : "",
    ].filter(Boolean);
    if (!marca.length && el !== layer) continue;
    const nome = `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`;
    out.push(`  ${nome.slice(0, 60)} → ${marca.join(" ") || "static"}  ${rect(el)}`);
  }
  return out;
}

/** Uma linha por mudança: todas as bordas de BAIXO, na mesma unidade. Se a
 *  folha andar ao contrário do teclado, é nesta linha que aparece. */
function amostra(containerEl: HTMLElement, t0: number): string {
  const doc = containerEl.ownerDocument;
  const win = doc.defaultView as Window;
  const vv = win.visualViewport;
  const b = (el: Element | null | undefined) =>
    el ? Math.round(el.getBoundingClientRect().bottom) : "—";
  const layer =
    doc.querySelector(".axxa-sheet-layer.is-open") ??
    containerEl.querySelector(".axxa-sheet-layer.is-open");
  const sheet = layer?.querySelector(".axxa-sheet") ?? null;
  const sheetTop = sheet ? Math.round(sheet.getBoundingClientRect().top) : "—";
  const btn =
    layer?.querySelector(".axxa-form-submit") ??
    layer?.querySelector(".axxa-sheet-actions button") ??
    null;
  const kb = doc.documentElement.style.getPropertyValue("--keyboard-height") || "0";
  const pos = layer ? win.getComputedStyle(layer).position : "—";
  const cls = doc.body.classList.contains("axxa-keyboard-open") ? "kbOpen" : "kbClosed";
  const nav = doc.body.classList.contains("is-hidden-nav") ? "navHidden" : "navShown";
  return (
    `t=+${((Date.now() - t0) / 1000).toFixed(1)}s kb=${kb} inner=${win.innerHeight}` +
    ` vv=${vv ? Math.round(vv.height) : "?"} ${cls} ${nav}` +
    ` | gaveta=${b(containerEl.closest(".workspace-drawer"))}` +
    ` raiz=${b(containerEl.querySelector(".axxa-root"))}` +
    ` composer=${b(containerEl.querySelector(".axxa-composer"))}` +
    ` | camada(${pos})=${b(layer)} folha=${sheetTop}..${b(sheet)} botão=${b(btn)}`
  );
}

/**
 * Grava por `ms` e devolve o texto. Uma linha a cada mudança do estilo do
 * <html> (é onde o Obsidian escreve `--keyboard-height`) e, de reserva, a cada
 * meio segundo se nada mudou — porque o que mexe na folha pode não passar por
 * ali, e é exatamente essa a hipótese que a gravação existe pra testar.
 */
export function gravarTeclado(
  containerEl: HTMLElement,
  ms: number,
  aoTerminar: (texto: string) => void
): void {
  const doc = containerEl.ownerDocument;
  const win = doc.defaultView as Window;
  const t0 = Date.now();
  const linhas: string[] = [];
  let ultima = "";
  let cadeia: string[] = [];
  const anotar = () => {
    const l = amostra(containerEl, t0);
    // O tempo muda sempre; o resto é que diz se algo aconteceu.
    const semTempo = l.replace(/^t=\S+ /, "");
    if (semTempo === ultima) return;
    ultima = semTempo;
    linhas.push(l);
    // A cadeia é lida na primeira vez em que HÁ uma folha aberta — no começo
    // da gravação a pessoa ainda está na paleta de comandos.
    if (!cadeia.length && doc.querySelector(".axxa-sheet-layer.is-open")) {
      cadeia = cadeiaDaFolha(doc.querySelector(".axxa-sheet-layer.is-open"), win);
    }
  };
  const obs = new MutationObserver(anotar);
  obs.observe(doc.documentElement, { attributes: true, attributeFilter: ["style"] });
  obs.observe(doc.body, { attributes: true, attributeFilter: ["class"] });
  const tique = win.setInterval(anotar, 500);
  anotar();
  win.setTimeout(() => {
    obs.disconnect();
    win.clearInterval(tique);
    anotar();
    aoTerminar(
      [
        "AXXA · keyboard recording",
        new Date().toISOString(),
        `screen=${win.screen.width}x${win.screen.height} dpr=${win.devicePixelRatio}`,
        "",
        "[cadeia da folha]  (quem pode estar contendo a camada)",
        ...(cadeia.length ? cadeia : ["  (nenhuma folha abriu durante a gravação)"]),
        "",
        "[linha do tempo]  (bordas de BAIXO, px do topo da tela)",
        ...linhas,
      ].join("\n")
    );
  }, ms);
}
