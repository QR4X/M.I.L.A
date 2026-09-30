// src/providers/modelRoles.ts
// "Papéis" funcionais dos modelos = as seções do editor Connections → Models.
// Cada papel agrupa uma ou mais ModelCategory e tem um ★ = o modelo-padrão pra
// aquela função (chat, reasoning, imagem, vídeo, TTS, embedding). Unifica os
// defaults que viviam espalhados (defaultModel/anthropicModel/…/ragEmbeddingModel).
// v0.1.236

import type { ModelCategory } from "./modelDescriptions";

/** Modelo escolhido pra um papel: o ID + de qual provider (dedup cross-provider). */
export interface RoleModelEntry {
  model: string;
  provider: string;
}

/** Os 7 papéis = seções (na ordem que aparecem no editor). */
export type RoleId =
  | "chat" // chat-vision + chat-text + agent
  | "reasoning"
  | "image"
  | "video"
  | "tts" // audio-gen
  | "embedding"
  | "other";

export const ROLE_ORDER: RoleId[] = [
  "chat",
  "reasoning",
  "image",
  "video",
  "tts",
  "embedding",
  "other",
];

export const ROLE_LABELS: Record<RoleId, string> = {
  chat: "Chat",
  reasoning: "Reasoning",
  image: "Image",
  video: "Video",
  tts: "Text-to-speech",
  embedding: "Text embedding",
  other: "Other",
};

/** Ícone Lucide do "brasão" de cada papel. */
export const ROLE_ICONS: Record<RoleId, string> = {
  chat: "messages-square",
  reasoning: "brain",
  image: "image",
  video: "clapperboard",
  tts: "audio-lines",
  embedding: "boxes",
  other: "box",
};

/** Mapeia a categoria semântica do modelo → papel (seção). As 3 variantes de
 *  chat (vision/text/agent) caem todas em "chat". */
export function categoryToRole(cat: ModelCategory): RoleId {
  switch (cat) {
    case "chat-vision":
    case "chat-text":
    case "agent":
      return "chat";
    case "reasoning":
      return "reasoning";
    case "image-gen":
      return "image";
    case "video-gen":
      return "video";
    case "audio-gen":
      return "tts";
    case "embedding":
      return "embedding";
    default:
      return "other";
  }
}
