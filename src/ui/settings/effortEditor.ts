// src/ui/settings/effortEditor.ts
// O que cada NÍVEL de esforço faz — editável de novo.
//
// O motor sempre leu `effortConfigs` (chat, agente e Vault Q&A), e a casca
// antiga tinha uma aba pra editar (v0.1.73). A aba sumiu no redesign da 0.4.0
// e os ajustes ficaram só no data.json. Volta aqui como um editor por nível,
// aberto da aba Chat. Os rótulos, limites e a regra do campo numérico vêm da
// casca antiga (`git show 0.3.0:src/components/settings/AxxaSettingsTab.ts`).

import { Modal, Notice, Setting, type App } from "obsidian";
import {
  DEFAULT_EFFORT_CONFIGS,
  EFFORT_LABELS,
  effortNumbers,
  resolveEffortConfig,
  type EffortConfig,
  type EffortLevel,
} from "../../core/effort";
import { ConfirmModal } from "../modals";

type Overrides = Partial<Record<EffortLevel, Partial<EffortConfig>>>;

/** Um campo do editor. */
export interface CampoDeEsforco {
  key: keyof EffortConfig;
  name: string;
  desc: string;
  tipo: "numero" | "chave";
  min?: number;
  max?: number;
  step?: number;
}

/** Os nove ajustes, na ordem em que a pessoa pensa neles: quanto escreve,
 *  quanto o agente anda, quão criativo, quanto do vault entra, e as travas. */
export const CAMPOS_DE_ESFORCO: CampoDeEsforco[] = [
  {
    key: "maxTokens",
    name: "Max response tokens",
    desc: "How long a reply can get. 0 = uncapped (uses the context reserve below).",
    tipo: "numero",
    min: 0,
    max: 200000,
    step: 256,
  },
  {
    key: "agentMaxTurns",
    name: "Agent: max turns",
    desc: "How many tool rounds the Agent can take before stopping. 0 = no cap (only the loop guard stops it).",
    tipo: "numero",
    min: 0,
    max: 1000,
    step: 1,
  },
  {
    key: "temperature",
    name: "Temperature",
    desc: "Randomness, 0–2: low is precise, high is creative. -1 = don't send it (the provider's default).",
    tipo: "numero",
    min: -1,
    max: 2,
    step: 0.1,
  },
  {
    key: "vaultTopK",
    name: "Vault Q&A: notes",
    desc: "How many notes Vault Q&A brings in as context.",
    tipo: "numero",
    min: 1,
    max: 100,
    step: 1,
  },
  {
    key: "vaultExcerptChars",
    name: "Vault Q&A: characters per note",
    desc: "How much of each of those notes goes in.",
    tipo: "numero",
    min: 100,
    max: 10000,
    step: 100,
  },
  {
    key: "parallelToolCalls",
    name: "Run tools in parallel",
    desc: "When the Agent asks for several tools at once, run them together (faster).",
    tipo: "chave",
  },
  {
    key: "toolRetryOnError",
    name: "Retry tools on error",
    desc: "Retries for tools that fail for a passing reason (network, timeout, locked file). A wrong path is never retried.",
    tipo: "numero",
    min: 0,
    max: 20,
    step: 1,
  },
  {
    key: "contextReservePercent",
    name: "Context reserve",
    desc: "With max tokens at 0, how much of the model's window (%) the reply can use. 80 leaves 20% for the prompt.",
    tipo: "numero",
    min: 10,
    max: 95,
    step: 5,
  },
  {
    key: "loopDetectionWindow",
    name: "Loop guard",
    desc: "How many identical tool calls in a row make the Agent stop and rethink. 0 = off.",
    tipo: "numero",
    min: 0,
    max: 20,
    step: 1,
  },
];

/** Prende o número no intervalo do campo. */
export function limitar(valor: number, campo: CampoDeEsforco): number {
  const min = campo.min ?? -Infinity;
  const max = campo.max ?? Infinity;
  return Math.max(min, Math.min(max, valor));
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

/** O editor de UM nível. Campo vazio = valor de fábrica (que aparece em
 *  cinza, como placeholder). */
export class EffortLevelModal extends Modal {
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
    this.desenhar();
  }

  onClose(): void {
    this.contentEl.empty();
    this.aoFechar();
  }

  private async gravar(key: keyof EffortConfig, valor: number | boolean | undefined) {
    this.plugin.settings.effortConfigs = comCampo(
      this.plugin.settings.effortConfigs ?? {},
      this.level,
      key,
      valor
    );
    await this.plugin.saveSettings();
  }

  private desenhar(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText(`${EFFORT_LABELS[this.level]} effort`);
    contentEl.createEl("p", {
      cls: "axxa-effort-intro",
      text: "Leave a field blank to use the default, shown in grey.",
    });
    const padrao = DEFAULT_EFFORT_CONFIGS[this.level];
    const atual = () => this.plugin.settings.effortConfigs?.[this.level] ?? {};

    for (const campo of CAMPOS_DE_ESFORCO) {
      const linha = new Setting(contentEl).setName(campo.name).setDesc(campo.desc);
      if (campo.tipo === "chave") {
        linha.addToggle((t) =>
          t
            .setValue((atual()[campo.key] as boolean | undefined) ?? (padrao[campo.key] as boolean))
            .onChange((v) => void this.gravar(campo.key, v))
        );
        continue;
      }
      linha.addText((text) => {
        const el = text.inputEl;
        el.type = "number";
        el.inputMode = campo.step && campo.step < 1 ? "decimal" : "numeric";
        if (campo.min !== undefined) el.min = String(campo.min);
        if (campo.max !== undefined) el.max = String(campo.max);
        if (campo.step !== undefined) el.step = String(campo.step);
        text.setPlaceholder(String(padrao[campo.key]));
        const salvo = atual()[campo.key];
        if (salvo !== undefined) text.setValue(String(salvo));
        // O limite só no blur/Enter (P1-01 da casca antiga): limitar a cada
        // tecla reescrevia o campo no meio da digitação — com mínimo 10,
        // digitar "25" virava "10" → "105" → "95".
        const confirmar = async (bruto: string, refletir: boolean) => {
          const limpo = bruto.trim();
          if (limpo === "") {
            await this.gravar(campo.key, undefined);
            return;
          }
          const n = Number(limpo);
          if (!Number.isFinite(n)) return;
          const preso = limitar(n, campo);
          if (refletir && preso !== n) text.setValue(String(preso));
          if (refletir || preso === n) await this.gravar(campo.key, preso);
        };
        text.onChange((v) => void confirmar(v, false));
        el.addEventListener("blur", () => void confirmar(el.value, true));
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter") void confirmar(el.value, true);
        });
      });
    }

    new Setting(contentEl).addButton((b) =>
      b.setButtonText("Restore defaults").onClick(async () => {
        const ok = await new ConfirmModal(this.app, {
          title: `Restore ${EFFORT_LABELS[this.level]} to its defaults?`,
          body: "Every field of this level goes back to the factory value.",
          confirmLabel: "Restore",
          danger: true,
        }).openAndWait();
        if (!ok) return;
        const resto = { ...(this.plugin.settings.effortConfigs ?? {}) };
        delete resto[this.level];
        this.plugin.settings.effortConfigs = resto;
        await this.plugin.saveSettings();
        new Notice(`${EFFORT_LABELS[this.level]} effort is back to defaults.`);
        this.desenhar();
      })
    );
  }
}
