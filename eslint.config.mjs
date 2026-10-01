// eslint.config.mjs
// O MESMO linter que a revisão automática do Obsidian roda (o pacote
// eslint-plugin-obsidianmd). Existe aqui pra a gente ver o relatório ANTES de
// submeter, em vez de descobrir na reprovação: `npm run lint`.
//
// Duas categorias reprovam a submissão (Error); o resto é aviso. Desde a
// 0.9.19 este linter não acusa nada que a revisão rode:
//
//   O `fetch` do streaming continua existindo — `fetchStream` em
//     src/providers/_shared.ts —, escrito como `window.fetch`, que é a MESMA
//     função. requestUrl não faz streaming, e streaming é o produto. Até a
//     0.9.18 ele aparecia aqui como no-restricted-globals (1×); a regra só
//     reconhece o nome solto. Declarar no README (0.9.18) não mudou a nota, e
//     o dono decidiu pelo `window.fetch` DECLARADO: o comentário no helper e o
//     README dizem com todas as letras que é o mesmo fetch. Não é outro
//     mecanismo; se o Obsidian der streaming ao requestUrl, troca-se ali.
//
//   ui/sentence-case (7×) — ruído deste linter, não da revisão
//     falso positivo de nome próprio: a regra quer "HTTP://localhost",
//     "Elevenlabs", "iphone". O bot da revisão nem roda esta regra.
//
//   react-hooks/exhaustive-deps (0)
//     os 6 efeitos que rodam só quando o resultado do assistente CHEGA têm a
//     razão escrita na linha.
//
// A revisão checa os tipos com o `strict` ligado; o nosso tsconfig não liga
// (daria 3 erros em outros arquivos), mas liga o `strictBindCallApply`. Sem
// ele, `.call()`/`.apply()` devolvem `any` AQUI e têm tipo LÁ — uma asserção
// que aqui é obrigatória vira "unnecessary assertion" na revisão (0.9.14,
// SettingsTab.ts:218). Pra espelhar a revisão inteira: troque o tsconfig pra
// `"strict": true` só durante um `npm run lint` e compare.
//
// O que já saiu, e como — pra ninguém refazer o caminho:
//   - settings-tab/prefer-setting-definitions (0.9.14): a aba descreve as
//     settings numa árvore (src/ui/settings/tree.ts) que o 1.13 desenha e
//     indexa na busca, e que o `display()` desenha antes do 1.13. Sem
//     `update()`: o que muda de texto se redesenha no lugar (ver SettingsTab);
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
