// src/ui/settings/tree.ts
// A ÁRVORE das settings: todas as linhas, a aba de cada uma e como cada uma se
// desenha. É a fonte única dos dois caminhos:
//
//   • Obsidian 1.13+ → `getSettingDefinitions()` devolve isto e o Obsidian
//                      desenha (cartões nativos + busca global das settings);
//   • 1.11.4–1.12.x  → o `display()` desenha a MESMA árvore (ver legacy.ts).
//
// As abas (Providers, Chat, …) e os providers NÃO são páginas do Obsidian:
// cada grupo leva a classe da sua aba (`axxa-set-tab-chat`) e do seu provider
// (`axxa-set-prov-openai`), e o CSS esconde o que não é a aba ativa pelos
// atributos `data-axxa-tab`/`data-axxa-prov` do container. Esconder por CSS, e
// não pelo `visible` da API, é o que deixa TODA linha na busca: no 1.13
// `visible: false` tira a linha da busca junto.
//
// Sem DOM aqui: a árvore é montada no `onload` (addSettingTab → update()) e
// nos testes, em node. Quem desenha são as funções `render` que a aba entrega
// (SettingsUi).
//
// Regras que o desenhista do 1.13 cobra (app.js 1.13.7):
//   • `name` sempre string — um nome que não é string quebra a busca inteira;
//   • título de grupo único, e dentro do grupo linhas com chave única
//     (`ctrl:<key>` pra control, `name:<nome>` pro resto) — repetido vira
//     "duplicate setting key" e reaproveita a linha errada no redesenho;
//   • a busca mostra SÓ o nome. Por isso as linhas `render` levam o nome longo
//     ("OpenAI API key") e o render troca pro curto na tela ("API key").

import type {
  Setting,
  SettingDefinition,
  SettingDefinitionGroup,
  SettingDefinitionItem,
  SettingGroup,
  SettingGroupItem,
} from "obsidian";
import type { AxxaSettings } from "../../main";
import { PROVIDERS } from "../../core/providersMeta";
import { EFFORT_LABELS, EFFORT_LEVELS } from "../../core/effort";
import { CHAT_MODES } from "../../core/session";
import { LOCALES } from "../../i18n";
import { PERMISSION_LABELS } from "../../agent/permissions";
import { ELEVEN_MODELS } from "../../providers/elevenlabs";
import { prettyModelName } from "../../providers/modelDescriptions";
import { FREE_TOKENS_AS_OF } from "../../usage/freeTokens";
import { OPENAI_TTS_MODELS, OPENAI_VOICES, STT_MODELS } from "../readAloud";
import type { BoolKey, TextKey } from "./values";

export type TabId = "providers" | "chat" | "vault" | "rag" | "agent" | "mobile";

export interface TabDef {
  id: TabId;
  label: string;
  /** Uma linha explicando o que mora aqui. */
  blurb: string;
  mobileOnly?: boolean;
}

export const TABS: TabDef[] = [
  {
    id: "providers",
    label: "Providers",
    blurb: "Your keys and the model each provider uses. Keys stay on this device.",
  },
  {
    id: "chat",
    label: "Chat",
    blurb: "What every new conversation starts with.",
  },
  { id: "vault", label: "Vault", blurb: "Where the plugin writes in your vault." },
  {
    id: "rag",
    label: "Q&A",
    blurb: "Vault Q&A: the local index that grounds answers in your notes.",
  },
  {
    id: "agent",
    label: "Agent",
    blurb: "What the agent may do to your notes without asking.",
  },
  {
    id: "mobile",
    label: "Mobile",
    blurb: "Options that only exist on the phone.",
    mobileOnly: true,
  },
];

export function tabsFor(isMobile: boolean): TabDef[] {
  return TABS.filter((t) => !t.mobileOnly || isMobile);
}

export type KeyField =
  | "openaiApiKey"
  | "anthropicApiKey"
  | "geminiApiKey"
  | "openrouterApiKey"
  | "nimApiKey";
export type ModelField =
  | "defaultModel"
  | "anthropicModel"
  | "geminiModel"
  | "openrouterModel"
  | "nimModel"
  | "ollamaModel";

export const PROVIDER_FIELDS: Record<string, { key?: KeyField; model: ModelField }> = {
  openai: { key: "openaiApiKey", model: "defaultModel" },
  anthropic: { key: "anthropicApiKey", model: "anthropicModel" },
  gemini: { key: "geminiApiKey", model: "geminiModel" },
  openrouter: { key: "openrouterApiKey", model: "openrouterModel" },
  nim: { key: "nimApiKey", model: "nimModel" },
  ollama: { model: "ollamaModel" },
};

/** Idiomas oferecidos pro ditado. Vazio = deixa o modelo detectar. */
export const SPEECH_LANGS: [string, string][] = [
  ["", "Auto (detect)"],
  ["pt", "Português"],
  ["en", "English"],
  ["es", "Español"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["it", "Italiano"],
  ["ja", "日本語"],
];

/** A linha desenhada à mão. Pode devolver a limpeza (roda antes de redesenhar). */
export type RowRender = (row: Setting, group: SettingGroup) => void | (() => void);

/** Onde uma linha mora — o que a busca precisa pra abrir a aba certa. */
export interface Place {
  tab: TabId;
  provider?: string;
}

/** O que a árvore pede à aba: estado pra decidir visibilidade e os desenhos. */
export interface SettingsUi {
  readonly isMobile: boolean;
  settings(): AxxaSettings;
  hasCredential(providerId: string): boolean;
  /** Quantos modelos do catálogo da OpenAI ganhariam cota com o data-sharing. */
  freeOfferCount(): number;
  nav: RowRender;
  rail: RowRender;
  /** Chave de API — ou o endpoint, no Ollama. */
  credential(providerId: string): RowRender;
  connection(providerId: string): RowRender;
  newChatModel(providerId: string): RowRender;
  fetchModels(providerId: string): RowRender;
  catalog(providerId: string): RowRender;
  freeOffer: RowRender;
  assistantModel: RowRender;
  ttsProvider: RowRender;
  elevenKey: RowRender;
  elevenFetch: RowRender;
  elevenVoice: RowRender;
  testVoice: RowRender;
  embeddingModel: RowRender;
  index: RowRender;
  hint(text: string): RowRender;
}

export interface SettingsTree {
  items: SettingDefinitionItem[];
  /** Linha/grupo → aba (e provider). Por identidade: é o objeto que a busca devolve. */
  places: WeakMap<object, Place>;
}

interface RowExtras {
  visible?: () => boolean;
  searchable?: boolean;
  aliases?: string[];
}

const KEY_ALIASES = ["key", "token", "chave", "credential", "credencial"];

/** O rótulo curto na tela, o longo na busca (o 1.13 escreve o nome ANTES do render). */
function shownAs(name: string, render: RowRender): RowRender {
  return (row, group) => {
    row.setName(name);
    return render(row, group);
  };
}

function options(pairs: Iterable<readonly [string, string]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [value, label] of pairs) out[value] = label;
  return out;
}

function toggle(
  name: string,
  desc: string,
  key: BoolKey,
  more: RowExtras = {}
): SettingDefinition {
  return { name, desc, control: { type: "toggle", key }, ...more };
}

function dropdown(
  name: string,
  desc: string,
  key: TextKey,
  opts: Record<string, string>,
  more: RowExtras = {}
): SettingDefinition {
  return { name, desc, control: { type: "dropdown", key, options: opts }, ...more };
}

function text(
  name: string,
  desc: string,
  key: TextKey,
  more: RowExtras = {}
): SettingDefinition {
  return { name, desc, control: { type: "text", key }, ...more };
}

/** Linha `render`. `shown` = o nome curto da tela (null = o mesmo da busca). */
function custom(
  name: string,
  shown: string | null,
  desc: string,
  render: RowRender,
  more: RowExtras = {}
): SettingDefinition {
  return {
    name,
    ...(desc ? { desc } : {}),
    render: shown ? shownAs(shown, render) : render,
    ...more,
  };
}

/**
 * Um render que explode não derruba a aba: no 1.13 o desenhista chama o render
 * sem try/catch, e um erro numa linha pararia o desenho de todas as de baixo.
 */
function guarded(render: RowRender): RowRender {
  return (row, group) => {
    try {
      return render(row, group);
    } catch (err) {
      console.error("[axxa] settings: uma linha falhou ao desenhar", err);
      row.setDesc("This setting failed to draw — see the developer console.");
    }
  };
}

/** Recado curto — o que falta pra linha de cima funcionar. Fora da busca. */
function hintRow(render: RowRender, visible?: () => boolean): SettingDefinition {
  return { name: "", render, searchable: false, ...(visible ? { visible } : {}) };
}

export function buildSettingsTree(ui: SettingsUi): SettingsTree {
  const items: SettingDefinitionItem[] = [];
  const places = new WeakMap<object, Place>();
  const s = () => ui.settings();

  function group(
    place: Place | null,
    opts: { heading?: string; cls?: string },
    rows: SettingGroupItem[]
  ): void {
    const cls = [
      "axxa-set-group",
      place ? `axxa-set-tab-${place.tab}` : "",
      place?.provider ? `axxa-set-prov-${place.provider}` : "",
      opts.cls ?? "",
    ]
      .filter(Boolean)
      .join(" ");
    for (const r of rows) {
      const withRender = r as { render?: RowRender };
      if (withRender.render) withRender.render = guarded(withRender.render);
    }
    const g: SettingDefinitionGroup = { type: "group", cls, items: rows };
    if (opts.heading) g.heading = opts.heading;
    if (place) {
      places.set(g, place);
      for (const r of rows) places.set(r, place);
    }
    items.push(g);
  }

  // ── a barra de abas: sempre à vista, sem cartão ──────────────────────────
  group(null, { cls: "axxa-set-flat axxa-set-navgroup" }, [
    { name: "", render: ui.nav, searchable: false },
  ]);

  // ── Providers ────────────────────────────────────────────────────────────
  group({ tab: "providers" }, { cls: "axxa-set-flat axxa-set-railgroup" }, [
    { name: "", render: ui.rail, searchable: false },
  ]);

  for (const p of PROVIDERS) {
    const f = PROVIDER_FIELDS[p.id];
    if (!f) continue;
    const at: Place = { tab: "providers", provider: p.id };

    group(at, { heading: p.name }, [
      f.key
        ? custom(
            `${p.name} API key`,
            "API key",
            "Stored in the OS keychain (not in data.json).",
            ui.credential(p.id),
            { aliases: KEY_ALIASES }
          )
        : custom(
            `${p.name} endpoint`,
            "Endpoint",
            "Local server address. Ollama needs no key.",
            ui.credential(p.id),
            { aliases: ["url", "server", "servidor", "endereço"] }
          ),
      custom(`${p.name} connection`, "Connection", "", ui.connection(p.id), {
        aliases: ["test", "testar", "conexão"],
      }),
      custom(
        `${p.name} model for new chats`,
        "Model for new chats",
        "Used when this provider is selected and nothing else was picked.",
        ui.newChatModel(p.id),
        { aliases: ["modelo", "default model"] }
      ),
    ]);

    // A cota diária é um programa DA OPENAI; prometê-la nos outros seria
    // inventar desconto.
    if (p.id === "openai") {
      group(at, { heading: "Free daily tokens" }, [
        toggle(
          "I share API data with OpenAI",
          "Their switch, in Data controls on platform.openai.com. Turning it on there gives your account a daily quota at no cost; telling us here is what makes this list show the real numbers.",
          "openaiDataSharing",
          // "tier" também: com o interruptor desligado a linha do tier some da
          // busca (no 1.13 `visible` falso tira dela), e quem procura "tier"
          // precisa cair aqui, no que faz ela aparecer.
          { aliases: ["free", "grátis", "quota", "cota", "data controls", "tier"] }
        ),
        // O tier só muda a cota de quem COMPARTILHA: com o interruptor
        // desligado não há cota nenhuma, e um seletor de tier ali seria uma
        // escolha que não faz nada. Aparece quando o interruptor liga.
        dropdown(
          "Usage tier",
          "Tiers 1–2 get 250k tokens/day on the big models and 2.5M/day on mini and nano. Tier 3 and up get 1M and 10M.",
          "openaiTier",
          options([1, 2, 3, 4, 5].map((n) => [String(n), `Tier ${n}`] as const)),
          {
            visible: () => s().openaiDataSharing === true,
            aliases: ["tier", "quota", "cota"],
          }
        ),
        hintRow(
          ui.freeOffer,
          () => !s().openaiDataSharing && ui.freeOfferCount() > 0
        ),
        hintRow(
          ui.hint(
            `The quota counts ALL your OpenAI API use, not just this vault — so anything the app says you have left is optimistic. Image models are never covered. Program terms as of ${FREE_TOKENS_AS_OF}.`
          )
        ),
      ]);
    }

    // Sem título: um "Models" por provider repetiria a chave do grupo. A
    // primeira linha já diz o que é o cartão.
    group(at, {}, [
      custom(
        `${p.name} models`,
        "Models",
        "Fetch what this provider offers today, then choose what shows up where.",
        ui.fetchModels(p.id),
        { aliases: ["modelos", "catalog", "catálogo", "favorites", "favoritos"] }
      ),
      { name: "", render: ui.catalog(p.id), searchable: false },
    ]);
  }

  // ── Chat ─────────────────────────────────────────────────────────────────
  const chat: Place = { tab: "chat" };
  group(chat, {}, [
    dropdown(
      "Provider",
      "Which provider a new chat opens with.",
      "defaultProvider",
      options(PROVIDERS.map((p) => [p.id, p.name] as const)),
      { aliases: ["default provider"] }
    ),
    dropdown(
      "Mode",
      "Chat, Vault Q&A or Agent. Locks on the first message.",
      "defaultMode",
      options(CHAT_MODES.map((m) => [m, m] as const)),
      { aliases: ["modo"] }
    ),
    dropdown(
      "Effort",
      "How hard the model works: length, agent turns, temperature.",
      "defaultEffort",
      options(EFFORT_LEVELS.map((l) => [l, EFFORT_LABELS[l]] as const)),
      { aliases: ["esforço", "reasoning"] }
    ),
    dropdown(
      "Language",
      "Interface, chat errors — and the language the model answers in. The creation assistant follows it too.",
      "language",
      options(LOCALES.map((l) => [l.id, l.label] as const)),
      { aliases: ["idioma", "língua", "portuguese", "português"] }
    ),
  ]);

  group(chat, { heading: "Assistant" }, [
    custom("Assistant model", "Model", "", ui.assistantModel, {
      aliases: ["modelo", "assistente", "skills", "projects"],
    }),
    toggle(
      "Let it see your note names",
      "So it can suggest which notes to attach to a project. Only the paths are sent — never what is inside them. Off by default.",
      "assistantSeesVault",
      { aliases: ["notes", "notas", "privacy", "privacidade"] }
    ),
  ]);

  // Voz: duas coisas diferentes, na ordem em que a pessoa decide — FALAR COM
  // o chat (ditado) e OUVIR o chat (leitura). Ligo? por quem? com que voz?
  const voiceOn = () => s().voiceEnabled;
  const ttsOn = () => s().ttsEnabled;
  // Tudo que não é "eleven" lê pela OpenAI — o mesmo critério de sempre.
  const openaiReads = () => s().ttsEnabled && s().ttsProvider !== "eleven";
  const elevenReads = () => s().ttsEnabled && s().ttsProvider === "eleven";

  group(chat, { heading: "Voice" }, [
    toggle(
      "Talk instead of typing",
      "Puts a microphone in the composer: you speak, the words land in the box, and you send when you are happy with them.",
      "voiceEnabled",
      // "voice" tem de achar os DOIS interruptores de voz: as linhas com
      // "Voice" no nome só existem com a leitura ligada (e escondida, a busca
      // do 1.13 não vê a linha).
      {
        aliases: [
          "voice",
          "speech to text",
          "dictation",
          "ditado",
          "microphone",
          "microfone",
          "voz",
        ],
      }
    ),
    hintRow(
      ui.hint("Dictation runs on OpenAI — add that key in Providers."),
      () => voiceOn() && !ui.hasCredential("openai")
    ),
    dropdown(
      "Ears",
      "Mini is quick, cheap and gets normal speech right; the full one is better with names, accents and noise.",
      "voiceModel",
      options(STT_MODELS.map((m) => [m, prettyModelName(m)] as const)),
      { visible: voiceOn, aliases: ["transcription", "transcrição", "whisper"] }
    ),
    dropdown(
      "What you speak",
      "Naming your language beats letting it guess — short takes are where guessing goes wrong.",
      "voiceLanguage",
      options(SPEECH_LANGS),
      { visible: voiceOn, aliases: ["idioma", "language"] }
    ),
    toggle(
      "Read answers out loud",
      "Adds a Listen button under every answer.",
      "ttsEnabled",
      {
        aliases: ["voice", "text to speech", "tts", "listen", "ouvir", "voz", "read aloud"],
      }
    ),
    custom(
      "Who reads",
      null,
      "OpenAI voices are ready to use. ElevenLabs sounds better and is the only one that can read in YOUR voice — clone it in their app and it shows up in the list below.",
      ui.ttsProvider,
      { visible: ttsOn, aliases: ["elevenlabs", "voz", "tts"] }
    ),
    hintRow(
      ui.hint("Add your OpenAI key in Providers to hear anything."),
      () => openaiReads() && !ui.hasCredential("openai")
    ),
    dropdown(
      "Voice",
      "Eleven of them. Hit Play sample to hear the one you picked.",
      "ttsVoice",
      options(OPENAI_VOICES.map((v) => [v, v] as const)),
      { visible: openaiReads, aliases: ["voz"] }
    ),
    dropdown(
      "Quality",
      "gpt-4o-mini-tts reads with intention; tts-1 is the cheap classic; the HD one is the same voice, cleaner.",
      "ttsModel",
      options(OPENAI_TTS_MODELS.map((m) => [m, m] as const)),
      { visible: openaiReads }
    ),
    custom(
      "Test OpenAI voice",
      "Test",
      "Plays one short line with the settings above.",
      ui.testVoice,
      { visible: openaiReads, aliases: ["play sample", "testar voz"] }
    ),
    custom(
      "ElevenLabs key",
      null,
      "From elevenlabs.io › Profile › API key. Stored in the OS keychain (not in data.json).",
      ui.elevenKey,
      { visible: elevenReads, aliases: KEY_ALIASES }
    ),
    custom(
      "Your voices",
      null,
      "Fetch what your account has — the stock voices and any you cloned, including your own.",
      ui.elevenFetch,
      { visible: elevenReads, aliases: ["clone", "cloned", "vozes", "elevenlabs"] }
    ),
    custom(
      "ElevenLabs voice",
      "Voice",
      "Cloned ones are marked — that is the one that sounds like you.",
      ui.elevenVoice,
      { visible: () => elevenReads() && s().elevenVoices.length > 0, aliases: ["voz"] }
    ),
    hintRow(
      ui.hint("No voices loaded yet — hit Fetch voices."),
      () => elevenReads() && s().elevenVoices.length === 0 && !!s().elevenApiKey
    ),
    dropdown(
      "Quality",
      "Multilingual sounds best; the faster ones answer sooner.",
      "elevenModel",
      options(ELEVEN_MODELS.map((m) => [m.id, m.label] as const)),
      { visible: elevenReads }
    ),
    custom(
      "Test ElevenLabs voice",
      "Test",
      "Plays one short line with the settings above.",
      ui.testVoice,
      { visible: elevenReads, aliases: ["play sample", "testar voz"] }
    ),
  ]);

  // ── Vault ────────────────────────────────────────────────────────────────
  group({ tab: "vault" }, {}, [
    text(
      "Chats folder",
      "Each chat is a .md file under <folder>/<mode>/. A folder starting with a dot is hidden from the file explorer, search and graph — which is why the default is .axxa/chats.",
      "chatsPath",
      { aliases: ["pasta", "conversas", "path"] }
    ),
    text(
      "Skills folder",
      "Each skill is a .md note (frontmatter + prompt body).",
      "skillsPath",
      { aliases: ["pasta", "path"] }
    ),
  ]);

  // ── Vault Q&A ────────────────────────────────────────────────────────────
  group({ tab: "rag" }, {}, [
    custom(
      "Embedding model",
      null,
      "Needs the key of that model's provider. Without an index, Vault Q&A falls back to keyword search.",
      ui.embeddingModel,
      { aliases: ["embeddings", "rag", "modelo"] }
    ),
    toggle(
      "Auto re-index on note changes",
      "Re-embeds only changed notes (costs tokens). Only runs once an index exists.",
      "ragAutoReindex",
      { aliases: ["reindex", "índice", "indice"] }
    ),
    custom("Index", null, "", ui.index, {
      aliases: ["índice", "indice", "index vault", "rag"],
    }),
  ]);

  // ── Agent ────────────────────────────────────────────────────────────────
  group({ tab: "agent" }, {}, [
    dropdown(
      "Permission level",
      "ask = confirm every write · vault = only deletes ask · yolo = only irreversible actions ask.",
      "agentPermissionLevel",
      options(Object.entries(PERMISSION_LABELS)),
      { aliases: ["permissão", "permissions", "yolo"] }
    ),
    toggle(
      "Show diff before applying edits",
      "Preview every change the agent wants to write.",
      "agentDiffApproval",
      { aliases: ["diff", "preview", "aprovação"] }
    ),
  ]);

  // ── Mobile (só no celular) ───────────────────────────────────────────────
  if (ui.isMobile) {
    group({ tab: "mobile" }, {}, [
      toggle(
        "Fullscreen",
        "Hides the drawer chrome and the global navbar while AXXA is the active tab. The menu button stays, so you are never stuck.",
        "mobileFullscreen",
        { aliases: ["tela cheia", "full screen"] }
      ),
      toggle(
        "Haptics",
        "A short buzz on every tap. Android only — iPhone doesn't let a plugin touch the Taptic Engine.",
        "hapticsEnabled",
        { aliases: ["vibration", "vibração", "vibrate"] }
      ),
    ]);
  }

  return { items, places };
}
