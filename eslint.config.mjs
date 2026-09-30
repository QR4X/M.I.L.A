// eslint.config.mjs
// O MESMO linter que a revisão automática do Obsidian roda (o pacote
// eslint-plugin-obsidianmd). Existe aqui pra a gente ver o relatório ANTES de
// submeter, em vez de descobrir na reprovação: `npm run lint`.
//
// Duas regras do conjunto reprovam a submissão (Error); as outras são aviso.
// O que fica aberto de propósito, e por quê:
//
//   no-restricted-globals (5×, `fetch` nos providers)
//     requestUrl não faz streaming, e streaming é o produto. Todo provider
//     tem o caminho não-streaming por requestUrl como fallback (mobile).
//
//   no-unsafe-* (~260×, providers)
//     é o `any` que sai de parsear JSON de API de terceiro. Tipar as seis
//     respostas é trabalho de verdade, não de véspera.
//
//   ui/sentence-case (20×)
//     falso positivo de nome próprio: a regra quer "HTTP://localhost",
//     "Elevenlabs", "iphone". Nosso texto já está em sentence case.
//
//   prefer-create-el (4×)
//     createEl/createDiv do Obsidian ANEXAM ao nó; esses quatro elementos
//     nascem soltos de propósito (ver os comentários em menu.ts e Markdown.tsx).
//
//   settings-tab/prefer-setting-definitions (1×)
//     API declarativa de settings do 1.13. Melhoria real, tarefa própria.
//
//   react-hooks/exhaustive-deps (6×, ChatView · ProjectSheet · SkillSheet)
//     efeitos que rodam de propósito só quando o ID muda. Os três do ChatView
//     estão desligados com a razão na linha; os do ProjectSheet e do SkillSheet
//     ficam como aviso pra serem olhados um por um — mexer em dependência de
//     efeito é o tipo de mudança que quebra em silêncio.

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
