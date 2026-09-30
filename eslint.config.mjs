// eslint.config.mjs
// O MESMO linter que a revisão automática do Obsidian roda (o pacote
// eslint-plugin-obsidianmd). Existe aqui pra a gente ver o relatório ANTES de
// submeter, em vez de descobrir na reprovação: `npm run lint`.
//
// Duas categorias reprovam a submissão (Error); o resto é aviso. Desde a
// 0.9.10 o que fica aberto neste linter são 2 avisos, os dois deliberados:
//
//   no-restricted-globals (1×, `fetchStream` em src/providers/_shared.ts)
//     requestUrl não faz streaming, e streaming é o produto. Os cinco
//     providers que fazem SSE por fetch passam por esse helper só; o resto do
//     tráfego vai por requestUrl (e o NIM, no desktop, por Node https).
//
//   settings-tab/prefer-setting-definitions (1×)
//     a API declarativa de settings do 1.13. Um `getSettingDefinitions()` que
//     devolva [] calaria o aviso sem pôr nenhuma configuração na busca — o
//     aviso continuaria verdadeiro, só que escondido. Implementar de verdade
//     troca a nossa aba pelo layout declarativo do Obsidian no 1.13+, e exige
//     `update()`, que é API 1.13 (o mínimo declarado é 1.11.4). Tarefa própria.
//
//   ui/sentence-case (20×) — ruído deste linter, não da revisão
//     falso positivo de nome próprio: a regra quer "HTTP://localhost",
//     "Elevenlabs", "iphone". O bot da revisão nem roda esta regra.
//
//   react-hooks/exhaustive-deps (0)
//     os 6 efeitos que rodam só quando o resultado do assistente CHEGA têm a
//     razão escrita na linha.
//
// O que já saiu, e como — pra ninguém refazer o caminho:
//   - prefer-create-el: o temporário do Markdown.tsx nasce de
//     `(el.win as typeof window).createDiv()` — o `createDiv` da janela do
//     próprio nó, instalado pelo enhance.js do Obsidian em TODA janela;
//   - no-deprecated (`setWarning`): `marcarPerigoso()` em ui/modals.ts reproduz
//     o que cada versão faz, pelas classes, sem chamar a API velha nem a nova;
//   - no-unsafe-* (~260): a forma das respostas das APIs foi declarada (0.9.4).
//
// O CSS tem linter PRÓPRIO na revisão (stylelint-config-obsidianmd — este aqui
// não olha .css). O que fica aberto lá, e por quê, está no cabeçalho de
// styles/main.css.

import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  {
    // Só o plugin. output/ é build, o resto é ferramenta nossa.
    ignores: [
      "output/**",
      "storybook/**",
      "storybook-static/**",
      "print/**",
      "scripts/**",
      "tests/**",
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.*"] },
      },
    },
  },
  // As regras de hooks não vêm no conjunto do Obsidian, e o ChatView tem três
  // efeitos que desligam exhaustive-deps de propósito. Sem o plugin, aquelas
  // linhas apontam pra uma regra que não existe — o que é erro por si só.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
]);
