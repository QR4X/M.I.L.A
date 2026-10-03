// src/i18n/tr.ts
// A TRADUÇÃO da interface, no jeito do gettext: o texto em inglês É a chave.
//
//   tr("Left today")                    → "Sobra hoje" (em pt-BR) ou o próprio inglês
//   tr("{n} chats", { n: 3 })           → "3 conversas"
//   marca("All time")                   → "All time" (só MARCA o texto pra tradução;
//                                         quem mostra chama tr() na hora de desenhar)
//
// Por que a chave é o inglês, e não um id ("usage.leftToday"): o código
// continua legível no idioma em que a interface foi escrita, um texto sem
// tradução cai no inglês em vez de mostrar um id, e o teste de cobertura
// (tests/i18nCompleto.test.ts) acha cada tr("…") e cada marca("…") do código
// e confere que o dicionário pt-BR tem os dois — com as mesmas {variáveis}.
//
// REGRA: tr() roda na hora de mostrar (render, abertura das settings, aviso),
// nunca no topo de um módulo — o idioma pode mudar com o app aberto. Texto
// guardado em constante usa marca() lá e tr() no uso.
//
// O dicionário do MOTOR (erros do chat, prompts do sistema, o agente) segue
// em en-us.ts / pt-br.ts (getTranslations); este aqui é o da casca.

import { PT_BR_UI } from "./ui-pt";
import { chaveCurta } from "./chave";

let dicionario: Record<string, string> = {};
let localeAtual: "en-US" | "pt-BR" = "en-US";
/** Texto → tradução já achada pela chave curta (a conta roda uma vez por texto). */
const achadas = new Map<string, string>();

/** O plugin troca o idioma da interface (ao carregar e a cada save). */
export function definirIdiomaDaInterface(locale: "en-us" | "pt-br"): void {
  dicionario = locale === "pt-br" ? PT_BR_UI : {};
  localeAtual = locale === "pt-br" ? "pt-BR" : "en-US";
  achadas.clear();
}

/**
 * A tradução de um texto num dicionário: pela própria frase (o dicionário da
 * FONTE, nos testes e no preview) ou pela chave curta dela (o do BUILD de
 * produção, que troca as chaves pra não repetir o inglês — ver i18n/chave.ts).
 */
export function traduzirCom(dic: Record<string, string>, texto: string): string | undefined {
  return dic[texto] ?? dic[chaveCurta(texto)];
}

/**
 * O locale de NÚMEROS e DATAS da interface ("pt-BR" ou "en-US"): em português,
 * "1.000" e "outubro"; em inglês, "1,000" e "October". Pra toLocaleString e
 * toLocaleDateString — nunca pra conta de fuso (aquilo é parse, não texto).
 */
export function localeDaInterface(): "en-US" | "pt-BR" {
  return localeAtual;
}

/** O texto no idioma da interface, com as {variáveis} preenchidas. */
export function tr(texto: string, vars?: Record<string, string | number>): string {
  // Em inglês o texto é a própria resposta; em português, a tradução achada
  // fica guardada — a conta da chave curta roda uma vez por texto.
  let base = texto;
  if (dicionario === PT_BR_UI) {
    const ja = achadas.get(texto);
    if (ja !== undefined) base = ja;
    else {
      base = traduzirCom(dicionario, texto) ?? texto;
      achadas.set(texto, base);
    }
  }
  if (!vars) return base;
  return base.replace(/\{(\w+)\}/g, (inteira, nome: string) =>
    Object.prototype.hasOwnProperty.call(vars, nome) ? String(vars[nome]) : inteira
  );
}

/** Marca um texto pra tradução sem traduzir agora (constantes de módulo). */
export function marca(texto: string): string {
  return texto;
}
