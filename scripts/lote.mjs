// scripts/lote.mjs
// A régua do lote: quantas modificações já entraram na `main` desde a última
// build de teste e desde a última estável — e se é hora de soltar uma ou outra.
//
// A regra (Rafael, 2026-10-01):
//   - a cada 3 modificações, uma BETA (`0.9.N-beta.M`, pré-release pro BRAT);
//   - com 10 modificações desde a última estável, uma RELEASE (bump nos três
//     arquivos de versão, bateria completa de lint, tag antes da main).
// A bateria final de lint (eslint, o espelho `strict` da revisão, stylelint)
// é da RELEASE; a beta só precisa dos testes e do build — que o próprio
// workflow da tag já roda.
//
// "Modificação" = um commit `fix`, `feat` ou `perf` (cada pedido vira um
// commit). `chore`, `docs`, `ci`, `test`, `refactor` e `style` não contam: não
// mudam nada que se teste no celular.
//
// Uso: `npm run lote` (ou `node scripts/lote.mjs --json`).

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const POR_BETA = 3;
export const POR_RELEASE = 10;

const MODIFICACAO = /^(fix|feat|perf)(\([^)]*\))?!?:/;

/** Quantos assuntos de commit contam como modificação. */
export function contar(assuntos) {
  return assuntos.filter((s) => MODIFICACAO.test(s.trim())).length;
}

/** A próxima versão de patch: 0.9.19 → 0.9.20. */
export function proximaEstavel(estavel) {
  const [a, b, c] = estavel.split(".").map(Number);
  return `${a}.${b}.${c + 1}`;
}

/** A próxima beta da próxima estável, depois das que já existem. */
export function proximaBeta(estavel, tags) {
  const alvo = proximaEstavel(estavel);
  const prefixo = `${alvo}-beta.`;
  const usadas = tags
    .filter((t) => t.startsWith(prefixo))
    .map((t) => Number(t.slice(prefixo.length)))
    .filter((n) => Number.isInteger(n));
  return `${prefixo}${usadas.length ? Math.max(...usadas) + 1 : 1}`;
}

/** O que fazer agora, dadas as duas contagens. Release vence beta. */
export function veredito(desdeEstavel, desdeTag) {
  if (desdeEstavel >= POR_RELEASE) return "release";
  if (desdeTag >= POR_BETA) return "beta";
  return "nada";
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function assuntosDesde(tag) {
  const out = git("log", `${tag}..HEAD`, "--format=%s");
  return out ? out.split("\n") : [];
}

function main() {
  const estavel = JSON.parse(readFileSync("manifest.json", "utf8")).version;
  const ultimaTag = git("describe", "--tags", "--abbrev=0");
  const tags = git("tag", "--list").split("\n");
  const desdeEstavel = contar(assuntosDesde(estavel));
  const desdeTag = contar(assuntosDesde(ultimaTag));
  const r = {
    estavel,
    ultimaTag,
    desdeEstavel,
    desdeTag,
    proximaBeta: proximaBeta(estavel, tags),
    proximaEstavel: proximaEstavel(estavel),
    agora: veredito(desdeEstavel, desdeTag),
  };
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  const s = (n) => (n === 1 ? "modificação" : "modificações");
  console.log(`Desde ${estavel} (estável): ${desdeEstavel} ${s(desdeEstavel)} — release com ${POR_RELEASE}.`);
  if (ultimaTag !== estavel) {
    console.log(`Desde ${ultimaTag} (beta): ${desdeTag} ${s(desdeTag)} — beta com ${POR_BETA}.`);
  }
  if (r.agora === "release") {
    console.log(`→ Hora da RELEASE ${r.proximaEstavel}: bump nos 3 arquivos, bateria completa de lint, tag antes da main.`);
  } else if (r.agora === "beta") {
    console.log(`→ Hora da BETA ${r.proximaBeta}: git tag ${r.proximaBeta} && git push origin ${r.proximaBeta}`);
  } else {
    console.log(`→ Ainda não: faltam ${POR_BETA - desdeTag} pra beta ${r.proximaBeta}.`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
