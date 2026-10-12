// src/ui/fontVars.ts
// As variáveis CSS de FONTE da interface, calculadas das settings (Aparência).
// Vazio nas settings = nada é escrito: o plugin herda a fonte e o corpo do
// Obsidian, exatamente como antes. Com um corpo dado (em px), a gente reescala
// os tokens de tamanho do Obsidian (--font-ui-*), que é o que TODO o app usa —
// é assim que "mudou a fonte e nada acompanhou" não acontece.
//
// Os multiplicadores são os MESMOS do app.css do Obsidian (estáveis há anos):
//
//   --font-ui-smaller: calc(var(--font-text-size) * 0.8)
//   --font-ui-small:   calc(var(--font-text-size) * 0.875)
//   --font-ui-medium:  var(--font-text-size)
//   --font-ui-large:   calc(var(--font-text-size) * 1.25)
//
// Então, com o corpo no padrão (16px), as variáveis viram os valores que o
// Obsidian já usaria — a UI não muda até você mexer.

export const UI_FONT_MULTIPLIERS = {
  smaller: 0.8,
  small: 0.875,
  medium: 1.0,
  large: 1.25,
} as const;

/** O corpo em px que a pessoa pediu ("15", "15px", " 16 px " → 15/16).
 *  Devolve null pra qualquer coisa que não seja um número em px. */
export function parseFontSize(input: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(px)?\s*$/i.exec(input);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** As variáveis de fonte a aplicar no root do app (e das settings). */
export function fontVarsFromSettings(s: {
  uiFontFamily?: string;
  uiFontSize?: string;
}): Record<string, string> {
  const vars: Record<string, string> = {};
  const fam = (s.uiFontFamily ?? "").trim();
  if (fam) vars["--axxa-font-family"] = fam;
  const px = parseFontSize(s.uiFontSize ?? "");
  if (px) {
    vars["--axxa-font-size"] = `${px}px`;
    vars["--font-ui-smaller"] = `${round2(px * UI_FONT_MULTIPLIERS.smaller)}px`;
    vars["--font-ui-small"] = `${round2(px * UI_FONT_MULTIPLIERS.small)}px`;
    vars["--font-ui-medium"] = `${round2(px * UI_FONT_MULTIPLIERS.medium)}px`;
    vars["--font-ui-large"] = `${round2(px * UI_FONT_MULTIPLIERS.large)}px`;
  }
  return vars;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
