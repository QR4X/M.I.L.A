// src/ui/settings/effortEditor.ts
// O que cada NÍVEL de esforço faz — editável de novo.
//
// O motor sempre leu `effortConfigs` (chat, agente e Vault Q&A), e a casca
// antiga tinha uma aba pra editar (v0.1.73). A aba sumiu no redesign da 0.4.0
// e os ajustes ficaram só no data.json. Volta aqui como um editor por nível,
// aberto da aba Chat. Os rótulos e limites vêm da casca antiga
// (`git show 0.3.0:src/components/settings/AxxaSettingsTab.ts`).
//
// A tela é a mais BAIXA possível (pedido do Rafael): um slider por ajuste,
// nome e valor numa linha só em cima dele, e nenhum texto de explicação na
// tela — ele mora no `title` da linha. Os valores especiais ("sem teto",
// "padrão do provider", "desligado") são paradas do próprio slider, então o
// slider sozinho diz o que antes precisava de uma frase.

import { Modal, Notice, setIcon, ToggleComponent, type App } from "obsidian";
import {
  DEFAULT_EFFORT_CONFIGS,
  EFFORT_LABELS,
  effortNumbers,
  resolveEffortConfig,
  tokensCurtos,
  type EffortConfig,
  type EffortLevel,
} from "../../core/effort";
import { ConfirmModal } from "../modals";

type Overrides = Partial<Record<EffortLevel, Partial<EffortConfig>>>;

/** Um campo do editor. */
export interface CampoDeEsforco {
  key: keyof EffortConfig;
  /** O nome na linha — curto: a tela não tem lugar pra explicação. */
  name: string;
  /** A explicação: vai no `title` da linha (e no leitor de tela). */
  desc: string;
  tipo: "numero" | "chave";
  min?: number;
  max?: number;
  /** As paradas do slider, NA ORDEM da trilha. O "sem teto" (0) mora na
   *  ponta direita, depois do maior número — é o maior de todos. */
  paradas?: number[];
  /** Como o valor aparece na linha ("2k tokens", "No cap"). */
  mostrar?: (v: number) => string;
  /** A linha só aparece quando isto vale: a parte do contexto só conta com
   *  a resposta sem teto. */
  quando?: (cfg: EffortConfig) => boolean;
}

/** `ini`, `ini + passo`, … até `fim` — sem o lixo de ponto flutuante. */
function de(ini: number, fim: number, passo = 1): number[] {
  const out: number[] = [];
  for (let i = 0; ini + i * passo <= fim + 1e-9; i++) {
    out.push(Math.round((ini + i * passo) * 10) / 10);
  }
  return out;
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

/** Os nove ajustes, em três blocos: a resposta (tamanho, a parte do contexto
 *  quando não tem teto, temperatura), o agente (voltas, novas tentativas,
 *  trava de loop, paralelo) e o Vault Q&A (quantas notas, quanto de cada). */
export const CAMPOS_DE_ESFORCO: CampoDeEsforco[] = [
  {
    key: "maxTokens",
    name: "Reply length",
    desc: "How long a reply can get, in tokens. No cap = up to the share of context below.",
    tipo: "numero",
    min: 0,
    max: 200000,
    paradas: [
      256, 512, 1000, 1500, 2048, 3000, 4000, 6000, 8000, 12000, 16000, 24000, 32000,
      48000, 64000, 100000, 128000, 200000, 0,
    ],
    mostrar: (v) => (v === 0 ? "No cap" : `${tokensCurtos(v)} tokens`),
  },
  {
    key: "contextReservePercent",
    name: "Share of context",
    desc: "With no cap on the reply, how much of the model's window it can use — the rest is left for the prompt.",
    tipo: "numero",
    min: 10,
    max: 95,
    paradas: de(10, 95, 5),
    mostrar: (v) => `up to ${v}%`,
    quando: (cfg) => cfg.maxTokens === 0,
  },
  {
    key: "temperature",
    name: "Temperature",
    desc: "Randomness: low is precise, high is creative. Provider default = don't send it.",
    tipo: "numero",
    min: -1,
    max: 2,
    paradas: [-1, ...de(0, 2, 0.1)],
    mostrar: (v) => (v < 0 ? "Provider default" : String(v)),
  },
  {
    key: "agentMaxTurns",
    name: "Agent turns",
    desc: "How many tool rounds the Agent can take before stopping. No cap = only the loop guard stops it.",
    tipo: "numero",
    min: 0,
    max: 1000,
    paradas: [
      1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300, 500,
      1000, 0,
    ],
    mostrar: (v) => (v === 0 ? "No cap" : plural(v, "turn", "turns")),
  },
  {
    key: "toolRetryOnError",
    name: "Tool retries",
    desc: "Retries for tools that fail for a passing reason (network, timeout, locked file). A wrong path is never retried.",
    tipo: "numero",
    min: 0,
    max: 20,
    paradas: [...de(0, 10), 12, 15, 20],
    mostrar: (v) => (v === 0 ? "None" : plural(v, "retry", "retries")),
  },
  {
    key: "loopDetectionWindow",
    name: "Loop guard",
    desc: "How many identical tool calls in a row make the Agent stop and rethink.",
    tipo: "numero",
    min: 0,
    max: 20,
    paradas: de(0, 20),
    mostrar: (v) => (v === 0 ? "Off" : `${v} in a row`),
  },
  {
    key: "parallelToolCalls",
    name: "Run tools in parallel",
    desc: "When the Agent asks for several tools at once, run them together (faster).",
    tipo: "chave",
  },
  {
    key: "vaultTopK",
    name: "Vault Q&A notes",
    desc: "How many notes Vault Q&A brings in as context.",
    tipo: "numero",
    min: 1,
    max: 100,
    paradas: [...de(1, 20), 25, 30, 40, 50, 75, 100],
    mostrar: (v) => plural(v, "note", "notes"),
  },
  {
    key: "vaultExcerptChars",
    name: "Characters per note",
    desc: "How much of each of those notes goes in.",
    tipo: "numero",
    min: 100,
    max: 10000,
    paradas: [
      100, 200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 2500, 3000, 4000, 5000, 6000,
      8000, 10000,
    ],
    mostrar: (v) => `${v.toLocaleString("en-US")} chars`,
  },
];

/** Prende o número no intervalo do campo. */
export function limitar(valor: number, campo: CampoDeEsforco): number {
  const min = campo.min ?? -Infinity;
  const max = campo.max ?? Infinity;
  return Math.max(min, Math.min(max, valor));
}

/** Onde um valor fica na trilha: o "sem teto" (0, nos campos que o têm na
 *  ponta) é o maior de todos. */
function posicao(campo: CampoDeEsforco, v: number): number {
  return v === 0 && campo.paradas?.[campo.paradas.length - 1] === 0 ? Infinity : v;
}

/**
 * As paradas do slider de um campo, com o valor de agora incluído quando ele
 * não é uma delas: um número digitado no editor antigo (900 tokens, digamos)
 * continua exato — o slider ganha uma parada pra ele no lugar certo.
 */
export function paradasCom(campo: CampoDeEsforco, valor: number): number[] {
  const base = campo.paradas ?? [];
  if (base.includes(valor)) return base;
  const alvo = posicao(campo, valor);
  const i = base.findIndex((p) => posicao(campo, p) > alvo);
  return i < 0 ? [...base, valor] : [...base.slice(0, i), valor, ...base.slice(i)];
}

/**
 * O override de um nível depois de mudar UM campo. `undefined` ou o valor de
 * fábrica APAGAM a chave — o data.json guarda só o que difere do padrão, e um
 * nível sem nada editado some de `effortConfigs`.
 */
export function comCampo(
  overrides: Overrides,
  level: EffortLevel,
  key: keyof EffortConfig,
  valor: number | boolean | undefined
): Overrides {
  const atual: Partial<EffortConfig> = { ...(overrides[level] ?? {}) };
  if (valor === undefined || valor === DEFAULT_EFFORT_CONFIGS[level][key]) {
    delete atual[key];
  } else {
    (atual as Record<string, number | boolean>)[key] = valor;
  }
  const out: Overrides = { ...overrides };
  if (Object.keys(atual).length === 0) delete out[level];
  else out[level] = atual;
  return out;
}

/** Algum campo do nível foi mudado? */
export function nivelEditado(overrides: Overrides | undefined, level: EffortLevel): boolean {
  return Object.keys(overrides?.[level] ?? {}).length > 0;
}

/** A linha do nível nas settings: os números que valem agora. */
export function resumoDoNivel(overrides: Overrides | undefined, level: EffortLevel): string {
  const cfg = resolveEffortConfig(level, overrides);
  const temp = cfg.temperature < 0 ? "provider temperature" : `temperature ${cfg.temperature}`;
  return `${effortNumbers(cfg)} · ${temp} · ${cfg.vaultTopK} notes`;
}

/** O que o editor precisa do plugin — o teste consegue fingir. */
export interface Gravador {
  settings: { effortConfigs: Overrides };
  saveSettings(): Promise<void>;
}

/** Uma linha desenhada, pra quem precisa repintá-la (a dependência do teto,
 *  o "restaurar tudo"). */
interface LinhaViva {
  campo: CampoDeEsforco;
  el: HTMLElement;
  /** Põe a linha no valor de agora (o salvo, ou o de fábrica). */
  repor(): void;
}

/** O editor de UM nível. Valor em cinza = o de fábrica do nível; mexeu, ele
 *  ganha a cor do texto e um ↺ que devolve o de fábrica. */
export class EffortLevelModal extends Modal {
  private linhas: LinhaViva[] = [];
  /** O "Restore" do cabeçalho, ao lado do X: devolve ESTE nível aos padrões
   *  dele — cada nível tem os seus, e os outros ficam como estão. */
  private restaurarEl: HTMLButtonElement | null = null;

  constructor(
    app: App,
    private readonly plugin: Gravador,
    private readonly level: EffortLevel,
    private readonly aoFechar: () => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("axxa-effort-modal");
    this.titleEl.setText(`${EFFORT_LABELS[this.level]} effort`);
    this.desenhar();
    this.montarRestaurar();
  }

  onClose(): void {
    this.contentEl.empty();
    this.aoFechar();
  }

  private editado(): Partial<EffortConfig> {
    return this.plugin.settings.effortConfigs?.[this.level] ?? {};
  }

  private async gravar(key: keyof EffortConfig, valor: number | boolean | undefined) {
    this.plugin.settings.effortConfigs = comCampo(
      this.plugin.settings.effortConfigs ?? {},
      this.level,
      key,
      valor
    );
    await this.plugin.saveSettings();
    this.pintarRestaurar();
  }

  /** Mostra só as linhas que valem com estes números (ver `quando`). */
  private mostrarDependentes(cfg: EffortConfig): void {
    for (const l of this.linhas) {
      if (l.campo.quando) l.el.toggleClass("is-hidden", !l.campo.quando(cfg));
    }
  }

  private desenhar(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.linhas = [];
    const lista = contentEl.createDiv({ cls: "axxa-esf" });
    for (const campo of CAMPOS_DE_ESFORCO) {
      this.linhas.push(
        campo.tipo === "chave" ? this.linhaDeChave(lista, campo) : this.linhaDeNumero(lista, campo)
      );
    }
    this.mostrarDependentes(resolveEffortConfig(this.level, this.plugin.settings.effortConfigs));
  }

  /**
   * O "Restore": palavra e ícone no cabeçalho, encostado no X — não ocupa
   * altura nenhuma. O X é do Obsidian e muda de lugar e tamanho por
   * plataforma (44px a 12px da borda no Android, outro inset no iPhone, outro
   * no computador), então o Restore é MEDIDO contra ele em vez de copiar
   * números. E o título passa a parar antes dele: centrado, um "Extra high
   * effort" encostava no Restore até num celular de 412px.
   */
  private montarRestaurar(): void {
    const restaurar = this.modalEl.createEl("button", {
      cls: "axxa-esf-restaurar clickable-icon",
      attr: {
        type: "button",
        "aria-label": `Restore ${EFFORT_LABELS[this.level]}'s defaults`,
      },
    });
    setIcon(restaurar.createSpan({ cls: "axxa-esf-restaurar-ico" }), "rotate-ccw");
    restaurar.createSpan({ text: "Restore" });
    restaurar.addEventListener("click", () => void this.restaurarTudo());
    this.restaurarEl = restaurar;
    this.pintarRestaurar();

    const x = Array.from(this.modalEl.children).find(
      (el): el is HTMLElement =>
        el !== restaurar &&
        (el.hasClass("modal-close-button") || el.hasClass("modal-header-button"))
    );
    if (!x) {
      // Sem o X onde ele sempre esteve: o Restore entra no fluxo do cabeçalho
      // em vez de flutuar num lugar chutado.
      this.titleEl.parentElement?.appendChild(restaurar);
      restaurar.addClass("is-solto");
      return;
    }
    const rtl = this.modalEl.win.getComputedStyle(this.modalEl).direction === "rtl";
    // Distância da borda do fim do modal até o começo do X.
    const antesDoX = rtl ? x.offsetLeft + x.offsetWidth : this.modalEl.clientWidth - x.offsetLeft;
    restaurar.setCssStyles({
      top: `${x.offsetTop}px`,
      height: `${x.offsetHeight}px`,
      insetInlineEnd: `${antesDoX + 4}px`,
    });
    // O título para antes do Restore: o fim do cabeçalho fica reservado pros
    // dois botões.
    this.titleEl.parentElement?.setCssStyles({
      paddingInlineEnd: `${antesDoX + 4 + restaurar.offsetWidth + 8}px`,
    });
  }

  /** Sem nada editado, o Restore fica apagado — no lugar, sem sumir. */
  private pintarRestaurar(): void {
    if (this.restaurarEl) {
      this.restaurarEl.disabled = !nivelEditado(this.plugin.settings.effortConfigs, this.level);
    }
  }

  private async restaurarTudo(): Promise<void> {
    const nome = EFFORT_LABELS[this.level];
    const ok = await new ConfirmModal(this.app, {
      title: `Restore ${nome} to its defaults?`,
      body: `Every setting of ${nome} goes back to ${nome}'s own defaults. The other levels keep theirs.`,
      confirmLabel: "Restore",
      danger: true,
    }).openAndWait();
    if (!ok) return;
    const resto = { ...(this.plugin.settings.effortConfigs ?? {}) };
    delete resto[this.level];
    this.plugin.settings.effortConfigs = resto;
    await this.plugin.saveSettings();
    new Notice(`${nome} effort is back to its defaults.`);
    for (const l of this.linhas) l.repor();
    this.mostrarDependentes(DEFAULT_EFFORT_CONFIGS[this.level]);
    this.pintarRestaurar();
  }

  /** O cabeçalho comum: nome, o ↺ (escondido sem edição) e o valor. O ↺ vem
   *  ANTES do valor: escondido, o lugar dele fica entre os dois, e o valor
   *  continua encostado na ponta direita, alinhado com o fim do slider. */
  private topo(pai: HTMLElement, campo: CampoDeEsforco, padraoVisivel: string) {
    const topo = pai.createDiv({ cls: "axxa-esf-topo" });
    topo.createSpan({ cls: "axxa-esf-nome", text: campo.name });
    const volta = topo.createEl("button", {
      cls: "axxa-esf-volta clickable-icon",
      attr: {
        type: "button",
        "aria-label": `Back to the ${EFFORT_LABELS[this.level]} default (${padraoVisivel})`,
      },
    });
    setIcon(volta, "rotate-ccw");
    const valorEl = topo.createSpan({ cls: "axxa-esf-valor" });
    return { topo, valorEl, volta };
  }

  private linhaDeNumero(pai: HTMLElement, campo: CampoDeEsforco): LinhaViva {
    const padrao = DEFAULT_EFFORT_CONFIGS[this.level][campo.key] as number;
    const mostrar = campo.mostrar ?? String;
    const salvo = () => this.editado()[campo.key] as number | undefined;
    const linha = pai.createDiv({ cls: "axxa-esf-linha", attr: { title: campo.desc } });
    const { valorEl, volta } = this.topo(linha, campo, mostrar(padrao));

    // As paradas valem pela vida da tela: um valor antigo fora delas ganha a
    // sua (ver paradasCom) e continua alcançável depois de mexer.
    const paradas = paradasCom(campo, salvo() ?? padrao);
    const slider = linha.createEl("input", {
      cls: "slider axxa-esf-slider",
      attr: {
        type: "range",
        min: "0",
        max: String(paradas.length - 1),
        step: "1",
        "aria-label": campo.name,
        "aria-description": campo.desc,
      },
    });

    /** Pinta o valor `v` (sem gravar): número, cor, ↺, preenchimento. */
    const pintar = (v: number) => {
      const i = Math.max(0, paradas.indexOf(v));
      slider.value = String(i);
      slider.setCssProps({ "--slider-fill-ratio": String(i / (paradas.length - 1)) });
      slider.setAttribute("aria-valuetext", mostrar(v));
      valorEl.setText(mostrar(v));
      linha.toggleClass("is-custom", v !== padrao);
    };
    const daTrilha = () => paradas[Number(slider.value)] ?? padrao;
    /** O teto da resposta decide se a linha da parte do contexto existe. */
    const dependentes = (v: number) => {
      if (campo.key !== "maxTokens") return;
      const cfg = resolveEffortConfig(this.level, this.plugin.settings.effortConfigs);
      this.mostrarDependentes({ ...cfg, maxTokens: v });
    };

    // Arrastando: só a tela acompanha. Soltou: grava — uma escrita por
    // gesto, não uma por parada atravessada.
    slider.addEventListener("input", () => {
      const v = daTrilha();
      pintar(v);
      dependentes(v);
    });
    slider.addEventListener("change", () => {
      const v = daTrilha();
      pintar(v);
      dependentes(v);
      void this.gravar(campo.key, v);
    });
    volta.addEventListener("click", () => {
      pintar(padrao);
      dependentes(padrao);
      void this.gravar(campo.key, undefined);
    });

    const repor = () => pintar(salvo() ?? padrao);
    repor();
    return { campo, el: linha, repor };
  }

  private linhaDeChave(pai: HTMLElement, campo: CampoDeEsforco): LinhaViva {
    const padrao = DEFAULT_EFFORT_CONFIGS[this.level][campo.key] as boolean;
    const salvo = () => this.editado()[campo.key] as boolean | undefined;
    const linha = pai.createDiv({ cls: "axxa-esf-linha is-chave", attr: { title: campo.desc } });
    const { topo, valorEl, volta } = this.topo(linha, campo, padrao ? "on" : "off");
    valorEl.remove(); // o próprio interruptor é o valor
    const chave = new ToggleComponent(topo);
    chave.toggleEl.setAttribute("aria-label", campo.name);

    // O setValue do ToggleComponent CHAMA o onChange quando o valor muda —
    // sem esta trava, abrir a tela (ou o ↺) gravaria sozinho.
    let calado = false;
    const pintar = (v: boolean) => {
      calado = true;
      chave.setValue(v);
      calado = false;
      linha.toggleClass("is-custom", v !== padrao);
    };
    chave.onChange((v) => {
      if (calado) return;
      linha.toggleClass("is-custom", v !== padrao);
      void this.gravar(campo.key, v);
    });
    volta.addEventListener("click", () => {
      pintar(padrao);
      void this.gravar(campo.key, undefined);
    });

    const repor = () => pintar(salvo() ?? padrao);
    repor();
    return { campo, el: linha, repor };
  }
}
