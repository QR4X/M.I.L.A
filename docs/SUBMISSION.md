# Submissão ao Obsidian Community Plugins (#12)

Guia completo pra listar o AXXA Agent no diretório oficial. A submissão é **uma vez**;
depois disso os updates chegam sozinhos via GitHub Release (já automatizado em
`.github/workflows/release.yml`).

## 1. Pré-requisitos (já temos)

- [x] Repo público no GitHub (`axxalab/axxa-agent`).
- [x] `manifest.json` na raiz com `id`, `name`, `version`, `minAppVersion`,
      `description`, `author`, `isDesktopOnly`.
- [x] `versions.json` mapeando versão → minAppVersion.
- [x] Uma **GitHub Release** cujo tag == `manifest.json.version`, com
      `main.js` + `manifest.json` + `styles.css` anexados (a Action faz).
- [x] `LICENSE` (MIT).
- [x] `README.md` claro (PT + EN).

## 2. A entrada do `community-plugins.json`

Fork de [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases),
e **adicione no FIM do array** em `community-plugins.json`:

```json
{
  "id": "axxa-agent",
  "name": "AXXA Agent",
  "author": "Axxa Lab",
  "description": "Chat with AI, query your vault with local RAG, and let an agent read and edit your notes across six LLM providers. Bring your own API key.",
  "repo": "axxalab/axxa-agent"
}
```

`id` / `name` / `author` / `description` **têm que bater** com o `manifest.json`.
Abra um PR; o bot roda checagens automáticas e depois um humano revisa.

## 3. Checklist de review (passar de primeira)

- [x] **Sem telemetria/tracking.** O plugin só chama os providers que o user
      escolhe, com a chave dele. README já declara isso explicitamente.
- [x] **Keys no SecretStorage do OS** (não em `data.json`) desde v0.1.90 — por
      isso `minAppVersion 1.11.4`.
- [x] **CSS em `styles.css`**, não inline no JS (o build sincroniza
      `styles/main.css` → `output/styles.css`).
- [ ] **Fullscreen mobile: EXISTE, é opt-in, e mexe no chrome — declarar isso.**
      Esta linha já dizia "removido (v0.1.127)"; voltou depois e o texto ficou.
      Ir pro PR com ela seria afirmar à revisão algo falso — e isso custa mais
      caro que o próprio recurso. O que o plugin faz, de fato:
      · alterna as classes `axxa-fullscreen` / `axxa-keyboard-open` na gaveta e
        no `body` (AxxaView), e o CSS esconde `.workspace-drawer-header` e
        `.workspace-drawer-tab-options` enquanto o modo está ligado;
      · NÃO toca em API interna nem em variável do Obsidian — só classes;
      · desligado por padrão, e `onClose` desfaz (`clearFullscreen`), assim como
        `teardownKeyboardObserver` remove as classes do teclado.
      Declarar assim no PR é defensável. Afirmar que não existe, não.
- [x] **API privada:** auditado (v0.1.196). Único uso semi-privado é
      `app.setting.open()`/`openTabById()` — agora com optional-chaining +
      try/catch + comentário justificando; sem `innerHTML`; sem manipular o
      chrome do app. Justificativa pronta em `SUBMISSION_PR.md`.
- [x] **APIs de browser (mobile):** câmera usa `getUserMedia` no desktop e
      `<input capture>` nativo no mobile (v0.1.196); voz usa Web Speech API com
      feature-detection + degradação. Todas opt-in. Documentado no PR.
- [ ] **`fundingUrl`** (opcional) no manifest se quiser link de apoio.
- [ ] **Instalar o build num Obsidian de verdade** — desktop e celular — e usar.
      Tudo que foi verificado até aqui rodou no harness do preview, que imita o
      Obsidian mas não é ele. E o `id` mudou pra `axxa-agent` na 0.8.0: a pasta
      `.obsidian/plugins/axxa-os-ai-agent` precisa ser renomeada, senão o app
      aparece como plugin novo e sem as suas chaves.
- [x] **Network disclosure:** texto pronto em `SUBMISSION_PR.md` (sem telemetria;
      só os providers que o user escolhe, com a chave dele).

## 4. Riscos conhecidos a checar antes do PR

1. `app.setting.open()` / `openTabById` — API semi-privada usada pra abrir
   Settings. Provável OK, mas pode levantar flag.
2. `requestUrl` com `anthropic-dangerous-direct-browser-access` — documentar que
   é necessário pro Anthropic no browser/Electron.
3. Geração de imagem (Imagen/Nano Banana) faz `fetch`/`requestUrl` — coberto pelo
   disclosure de rede.

## 5. Depois de aprovado

Nada de re-review. Pra cada update: bumpe o `manifest.json` + commit, depois
`git tag 0.1.X && git push origin 0.1.X` → a Action publica a Release.
