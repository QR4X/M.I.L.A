// src/providers/modelLogo.ts
// O DESENHO de um modelo: a marca de quem o fez, quando a gente tem; o brasão
// da família, quando não.
//
// Por que isto existe: o id de um modelo do OpenRouter carrega o fabricante no
// prefixo (`anthropic/claude-3.5-sonnet`, `meta-llama/llama-3.3-70b`), e a
// gente já tem os logos de seis marcas registrados como ícones do Obsidian
// (ver ui/brandLogos.ts). Usar o logo certo num seletor de modelo é a
// diferença entre uma lista que se varre com o olho e uma lista que se lê.
//
// Onde não há logo — Meta, DeepSeek, Mistral, Qwen, xAI — não se inventa um
// genérico: cai no ícone da FAMÍLIA, que já é curado em modelFamily.ts (llama
// é chama, deepseek é âncora, mistral é vento). Um "caixinha" pra todos seria
// pior que nada, porque ensinaria que o desenho não quer dizer coisa alguma.

import { getModelFamily } from "./modelFamily";

/**
 * Fabricante → o logo que temos.
 *
 * As chaves são os prefixos como o OpenRouter os escreve. Vários apontam pro
 * mesmo logo de propósito: `google` e `gemini` são a mesma casa, e `nvidia` e
 * `nim` também.
 */
const MARCAS: Record<string, string> = {
  openai: "logo-openai",
  anthropic: "logo-anthropic",
  google: "logo-gemini",
  gemini: "logo-gemini",
  nvidia: "logo-nvidia",
  nim: "logo-nvidia",
  ollama: "logo-ollama",
  openrouter: "logo-openrouter",
  // Fabricantes de modelo. Vários nomes pro mesmo: o OpenRouter escreve
  // `meta-llama`, o Ollama escreve `llama`, e os dois são a mesma casa.
  meta: "logo-meta",
  "meta-llama": "logo-meta",
  llama: "logo-meta",
  deepseek: "logo-deepseek",
  "deepseek-ai": "logo-deepseek",
  mistral: "logo-mistral",
  mistralai: "logo-mistral",
  qwen: "logo-qwen",
  alibaba: "logo-qwen",
  "z-ai": "logo-zai",
  zai: "logo-zai",
  zhipu: "logo-zai",
  bytedance: "logo-bytedance",
  "black-forest-labs": "logo-flux",
  stabilityai: "logo-stability",
  stability: "logo-stability",
};

/** O fabricante declarado no id (`vendor/modelo`), ou "" quando não há. */
export function vendorDoModelo(id: string): string {
  const s = (id || "").trim().toLowerCase();
  const barra = s.indexOf("/");
  return barra > 0 ? s.slice(0, barra) : "";
}

/**
 * O ícone de um modelo — logo da marca quando existe, brasão da família quando
 * não.
 *
 * Também serve pra id SEM fabricante no nome (`gpt-5`, `claude-opus-4-8`), que
 * é como os providers diretos escrevem: aí a família responde, e ela conhece
 * esses nomes.
 */
export function modelLogo(id: string): string {
  const marca = MARCAS[vendorDoModelo(id)];
  if (marca) return marca;
  // Sem fabricante no id: tenta reconhecer a casa pelo NOME antes de cair na
  // família. "gpt-5" é da OpenAI mesmo sem ninguém dizer.
  const s = (id || "").toLowerCase();
  if (/(^|[^a-z])(gpt|o[1-9]|dall-e)/.test(s)) return "logo-openai";
  if (s.includes("claude")) return "logo-anthropic";
  // O Nano Banana ANTES do Gemini: ele É um Gemini, e o teste genérico
  // engoliria o específico — que é justamente o que tem marca própria.
  if (/(nano-?banana)/.test(s)) return "logo-nanobanana";
  if (s.includes("gemini") || s.includes("gemma")) return "logo-gemini";
  if (s.includes("nemotron")) return "logo-nvidia";
  // Pelo NOME, pra quem escreve sem fabricante (o Ollama é assim: "llama3.2",
  // "qwen2.5", "mistral", "deepseek-r1").
  if (s.includes("llama")) return "logo-meta";
  if (s.includes("deepseek")) return "logo-deepseek";
  if (/(mistral|mixtral|codestral|ministral|pixtral|magistral)/.test(s))
    return "logo-mistral";
  if (s.includes("qwen")) return "logo-qwen";
  if (/\bglm\b/.test(s)) return "logo-zai";
  if (s.includes("flux")) return "logo-flux";
  if (/(stable-?diffusion|sdxl)/.test(s)) return "logo-stability";
  return getModelFamily(id).icon;
}
