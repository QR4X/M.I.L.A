// eslint.config.mjs
// O MESMO linter que a revisão automática do Obsidian roda (o pacote
// eslint-plugin-obsidianmd). Existe aqui pra a gente ver o relatório ANTES de
// submeter, em vez de descobrir na reprovação: `npm run lint`.
//
// Duas categorias reprovam a submissão (Error); o resto é aviso. A 0.9.4
// derrubou os avisos de TypeScript de ~290 pra 10, tipando a resposta das APIs
// (`JSON.parse` devolve `any`, e `any` desliga a checagem de tudo que encosta
// nele). O que fica é deliberado:
//
//   no-restricted-globals (5×, `fetch` nos providers)
//     requestUrl não faz streaming, e streaming é o produto. Todo provider
//     tem o caminho não-streaming por requestUrl como fallback (mobile).
//
//   prefer-create-el (1×, Markdown.tsx)
//     um nó temporário, solto de propósito, no documento do destino (janela
//     destacada). A regra sugere `el.ownerDocument.win.createDiv()`; apurado
//     na 0.9.9 que `createDiv` NÃO está declarado em `Window` na tipagem
//     oficial e que o app.js do Obsidian não usa `.win.createDiv(` nenhuma
//     vez. É sugestão, não API firmada — e o que depende disso é o markdown
//     de toda resposta do chat. Os outros 3 saíram na 0.9.6.
//
//   no-deprecated (2×, `setWarning`)
//     setDestructive é API 1.13 e o manifest declara minAppVersion 1.11.4.
//     Trocar vira Error — foi o que reprovou a 0.9.2.
//
//   settings-tab/prefer-setting-definitions (1×)
//     API declarativa de settings do 1.13. Adotar com o mínimo em 1.11.4
//     arrisca o mesmo Error acima; é tarefa própria, junto com subir o mínimo.
//
//   ui/sentence-case (20×)
//     falso positivo de nome próprio: a regra quer "HTTP://localhost",
//     "Elevenlabs", "iphone". Nosso texto já está em sentence case, e o bot
//     da revisão nem roda esta regra.
//
//   react-hooks/exhaustive-deps (0 agora)
//     os 6 efeitos que rodam só quando o resultado do assistente CHEGA têm a
//     razão escrita na linha. Listar `extras`/`set` faria a sugestão ser
//     re-aplicada por cima do que a pessoa está digitando.
//
// O CSS tem linter PRÓPRIO na revisão (este aqui não olha .css). O que fica
// aberto lá, e por quê, está no cabeçalho de styles/main.css.

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
