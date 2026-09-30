// scripts/genLogos.mjs
// Gera src/ui/brandLogos.ts a partir de assets/svg/ — só os logos dos SEIS
// providers (o bundle tem teto de tamanho; o resto do acervo fica no assets/).
// Cada SVG é normalizado pro espaço 0 0 100 100 (convenção do addIcon do
// Obsidian) via translate+scale, preservando cores próprias (logos coloridos)
// ou currentColor (logos mono). Rode: `node scripts/genLogos.mjs`.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = "assets/svg";
const OUT = "src/ui/brandLogos.ts";
const r = (n) => Math.round(n * 1e4) / 1e4;

// Só o que a UI usa: os ids batem com PROVIDERS[].icon (core/providersMeta).
//
// Onde existe versão COLORIDA no acervo, é ela que entra: o logo do provider
// no composer é identidade, e identidade é cor. Onde a marca é mono de
// verdade (OpenAI, OpenRouter, Ollama são preto/branco), fica o currentColor —
// pintar de verde ou roxo seria inventar uma marca que não existe.
const WANTED = [
  // Os PROVIDERS (a casa com quem se fala).
  { file: "openai.svg", id: "logo-openai" },
  { file: "claude-color.svg", id: "logo-anthropic" },
  { file: "gemini-color.svg", id: "logo-gemini" },
  { file: "openrouter.svg", id: "logo-openrouter" },
  { file: "nvidia-color.svg", id: "logo-nvidia" },
  { file: "ollama.svg", id: "logo-ollama" },
  // Os FABRICANTES dos modelos (quem fez o que roda pelo OpenRouter).
  //
  // Eles ficavam de fora "por teto de bundle". O custo real, MEDIDO: +14,6KB
  // cru e +5,6KB gzip pros nove — não é de graça, e vale. O que se comprava
  // com essa economia era uma lista de modelos onde metade dos nomes não tinha
  // rosto: "Llama 3.3", "Deepseek Chat" e "Mixtral" apareciam com um lucide
  // genérico, que é o mesmo que aparecer sem nada.
  { file: "meta-color.svg", id: "logo-meta" },
  { file: "deepseek-color.svg", id: "logo-deepseek" },
  { file: "mistral-color.svg", id: "logo-mistral" },
  { file: "qwen-color.svg", id: "logo-qwen" },
  { file: "zai.svg", id: "logo-zai" },
  { file: "bytedance-color.svg", id: "logo-bytedance" },
  // Os de GERAÇÃO de mídia — modelos como qualquer outro na hora de escolher.
  { file: "flux.svg", id: "logo-flux" },
  { file: "stability-color.svg", id: "logo-stability" },
  { file: "nanobanana-color.svg", id: "logo-nanobanana" },
];
/**
 * Troca gradiente por cor chapada — onde isso não muda o que se vê.
 *
 * Estes logos são desenhados a 14–20px. Nesse tamanho, um degradê entre dois
 * tons vizinhos da mesma marca (o logo da Meta tem TREZE, todos entre azuis
 * quase iguais) é indistinguível de uma cor sólida: paga-se em bytes por uma
 * diferença que a tela não mostra.
 *
 * Só achata quando TODAS as paradas são opacas. Gradiente que termina em
 * `stop-opacity="0"` não é uma cor — é uma CAMADA de tinta por cima de outro
 * desenho (é assim que o Gemini ganha as quatro cores dele). Achatar essa
 * viraria um bloco sólido em cima do logo e destruiria a marca.
 */
function achataGradientes(svg) {
  const chapadas = new Map();
  for (const g of svg.matchAll(
    /<linearGradient[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/linearGradient>/g
  )) {
    const [, id, corpo] = g;
    const stops = [...corpo.matchAll(/<stop[^>]*>/g)].map((s) => s[0]);
    if (stops.length === 0) continue;
    const transparente = stops.some((s) => /stop-opacity="0(\.0+)?"/.test(s));
    if (transparente) continue;
    const cor = stops[0].match(/stop-color="([^"]+)"/)?.[1];
    if (cor) chapadas.set(id, cor);
  }
  if (chapadas.size === 0) return svg;

  let out = svg;
  for (const [id, cor] of chapadas) {
    out = out.replaceAll(`url(#${id})`, cor);
    // O gradiente some do <defs> junto com o último uso dele.
    out = out.replace(
      new RegExp(
        `<linearGradient[^>]*\\bid="${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>[\\s\\S]*?</linearGradient>`
      ),
      ""
    );
  }
  // <defs> que ficou vazio não precisa existir.
  return out.replace(/<defs>\s*<\/defs>/g, "");
}

const disponiveis = new Set(readdirSync(SRC).map((f) => f.toLowerCase()));
const files = WANTED.filter((w) => {
  const tem = disponiveis.has(w.file.toLowerCase());
  if (!tem) console.warn(`[logos] faltando: ${w.file}`);
  return tem;
});

const entries = [];
for (const { file: f, id } of files) {
  const raw = readFileSync(join(SRC, f), "utf8");

  const vbMatch = raw.match(/viewBox\s*=\s*"([^"]+)"/i);
  let [minX, minY, w, h] = vbMatch
    ? vbMatch[1].trim().split(/[\s,]+/).map(Number)
    : [0, 0, 24, 24];
  if (!w || !h || Number.isNaN(w) || Number.isNaN(h)) {
    [minX, minY, w, h] = [0, 0, 24, 24];
  }

  const scale = 100 / Math.max(w, h);
  const tx = (100 - w * scale) / 2 - minX * scale;
  const ty = (100 - h * scale) / 2 - minY * scale;

  let inner = raw
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();

  inner = achataGradientes(inner);
  // `nonzero` é o padrão do SVG: escrever é só peso.
  inner = inner.replace(/\s+fill-rule="nonzero"/g, "");

  // Escapa pro template string TS.
  inner = inner
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");

  // Mono (svgl exporta fill="currentColor" no <svg>) → propaga currentColor pro
  // <g> pra seguir o tema do Obsidian (sem isso, paths sem fill viram preto).
  // Coloridos preservam os fills próprios dos paths.
  const svgOpen = raw.match(/<svg[^>]*>/i)?.[0] ?? "";
  const isMono = /fill\s*=\s*"currentColor"/i.test(svgOpen);
  const gFill = isMono ? ' fill="currentColor"' : "";
  const wrapped = `<g${gFill} transform="translate(${r(tx)} ${r(ty)}) scale(${r(
    scale
  )})">${inner}</g>`;

  entries.push({ id, wrapped });
}

const body = entries
  .map((e) => `  "${e.id}": \`${e.wrapped}\`,`)
  .join("\n");

const out = `// src/ui/brandLogos.ts
// AUTO-GERADO por scripts/genLogos.mjs — NÃO editar à mão.
// Regenera com: node scripts/genLogos.mjs (fonte: assets/svg/*.svg)
//
// Logos dos providers, normalizados pro espaço 0 0 100 100 do addIcon.
// Coloridos preservam suas cores; mono herdam currentColor do tema.
// Uso: <Icon name="logo-openai" /> (via addIcon + setIcon).

import { addIcon } from "obsidian";

export const BRAND_LOGOS: Record<string, string> = {
${body}
};

/** Registra todos os logos no Obsidian. Chamar UMA vez no onload. */
export function registerBrandLogos(): void {
  for (const [id, svg] of Object.entries(BRAND_LOGOS)) {
    addIcon(id, svg);
  }
}
`;

writeFileSync(OUT, out, "utf8");
console.log(`[genLogos] ${entries.length} logos -> ${OUT}`);
console.log(entries.map((e) => "  " + e.id).join("\n"));
