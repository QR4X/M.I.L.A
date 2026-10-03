// src/i18n/ui-pt/index.ts
// O dicionário pt-BR da interface inteira, montado das partes (uma por área
// do app — cada uma é traduzida e revisada junto do código dela).

import { PT_CHAT } from "./chat";
import { PT_PLUGIN } from "./plugin";
import { PT_PROJETOS } from "./projetos";
import { PT_SETTINGS } from "./settings";
import { PT_SHELL } from "./shell";
import { PT_USAGE } from "./usage";

export const PT_BR_UI: Record<string, string> = {
  ...PT_SHELL,
  ...PT_CHAT,
  ...PT_USAGE,
  ...PT_PROJETOS,
  ...PT_SETTINGS,
  ...PT_PLUGIN,
};
