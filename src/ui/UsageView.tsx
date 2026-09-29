// src/ui/UsageView.tsx
// A página de USO: o cartão da home aberto, com o recorte na sua mão.
//
// O cartão responde "quanto, como e com quê" de relance e cabe em três linhas.
// Esta tela existe pras perguntas que não cabem ali e que sempre chegam
// depois: "quanto foi só o Opus?", "e no Agent?", "e na semana passada?".
//
// Ela não recalcula nada por conta própria — filtra as conversas e entrega a
// mesma agregação de sempre (usage/aggregate), a mesma do relatório. Dois
// caminhos pra mesma conta acabariam discordando, e é justamente aqui, onde
// se confere dinheiro, que discordar custa a confiança da tela inteira.
//
// O recorte é aplicado ANTES de somar: com ele aplicado no fim, o total diria
// uma coisa e a tabela outra.
//
// O DESENHO é o do resto do app, peça por peça: o número grande e os módulos
// são os do cartão da home; o período é o segmented da home; os filtros são
// as pílulas das folhas (com a contagem em expoente, como as categorias de
// ícone); e cada modelo leva o anel da fatia que o cartão já usa — aqui com o
// logo dentro, porque a página tem o espaço que o cartão não tem.

import { useMemo, useState, type CSSProperties } from "react";
import { Notice } from "obsidian";
import type AxxaPlugin from "../main";
import type { ChatSession } from "../core/session";
import { useChatSummaries, providerIcon } from "./ChatList";
import { Icon } from "./Icon";
import { Segmented } from "./Segmented";
import { aggregateFromSummaries, type ChatUsageRow } from "../usage/aggregate";
import { formatUsd, formatUsdRounded } from "../usage/pricing";
import { formatCompact } from "../usage/format";
import { saveUsageMarkdown } from "../usage/export";
import {
  FILTRO_VAZIO,
  alternar,
  aplicar,
  opcoes,
  type Opcao,
  type UsageFilter,
} from "../usage/filters";
import {
  A_VISTA,
  buscarOpcoes,
  conversasDoTopo,
  faixaDeDatas,
  marcados,
  mediaPorConversa,
  metricaDa,
  modelosDaPagina,
  opcoesAVista,
  relatorioDe,
  semADimensao,
  valeFiltrar,
  type Fatia,
  type Metrica,
} from "../usage/page";
import { Sheet, SheetNote, SheetSearch } from "./Sheet";
import { moduleIcon, moduleLabel, relativeShort } from "./modules";
import { PROVIDERS } from "../core/providersMeta";
import { prettyModelName } from "../providers/modelDescriptions";
import { modelLogo } from "../providers/modelLogo";

/** Janelas do período, em dias (0 = tudo). O id é o número em texto. */
const PERIODOS = [
  { id: "0", label: "All time" },
  { id: "7", label: "7 days" },
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
];

/** Quantas conversas a lista do topo mostra. */
const TOPO = 10;

/** A partir de quantas opções a lista inteira ganha busca. Com poucas, o
 *  campo seria uma linha a mais pra ler antes de chegar no que se procura. */
const BUSCA_A_PARTIR = 8;

/** Os filtros de lista: o que cada dimensão marca, como se chama e se desenha. */
type Dimensao = "providers" | "models" | "modes";

export function UsageView({
  plugin,
  session,
  filtro: f,
  onFiltro: setF,
  onBack,
  onOpenChat,
}: {
  plugin: AxxaPlugin;
  session: ChatSession;
  /** O recorte. Mora no App: abrir uma conversa daqui desmonta esta tela, e
   *  a volta tem que achar o recorte onde ele estava. */
  filtro: UsageFilter;
  onFiltro: (f: UsageFilter) => void;
  onBack: () => void;
  /** Uma conversa da lista foi aberta — a tela troca pra ela. */
  onOpenChat: () => void;
}) {
  const chats = useChatSummaries(plugin);
  const [salvando, setSalvando] = useState(false);
  /** A lista inteira de uma dimensão (o "See all"). A dimensão fica guardada
   *  mesmo com a folha fechada: ela desce DESLIZANDO, e o conteúdo tem que
   *  continuar lá durante a descida em vez de sumir no primeiro quadro. */
  const [lista, setLista] = useState<Dimensao>("models");
  const [listaAberta, setListaAberta] = useState(false);
  const [buscaLista, setBuscaLista] = useState("");

  // As opções saem das conversas INTEIRAS, não do recorte: se elas
  // encolhessem junto, marcar um provider apagaria os outros da lista e não
  // haveria como desmarcar.
  const porProvider = useMemo(() => opcoes(chats, "provider"), [chats]);
  const porModelo = useMemo(() => opcoes(chats, "model"), [chats]);
  const porModo = useMemo(() => opcoes(chats, "mode"), [chats]);

  const recorte = useMemo(() => aplicar(chats, f), [chats, f]);
  const agg = useMemo(() => aggregateFromSummaries(recorte, 0), [recorte]);
  const m = metricaDa(agg.total);
  const modelos = useMemo(() => modelosDaPagina(agg), [agg]);
  const topo = useMemo(() => conversasDoTopo(agg, TOPO), [agg]);
  const media = mediaPorConversa(agg.total);

  const dimensoes: Array<{
    chave: Dimensao;
    titulo: string;
    /** O título da lista inteira ("Models"). */
    plural: string;
    ops: Opcao[];
    nome: (id: string) => string;
    icone: (id: string) => string;
  }> = [
    {
      chave: "providers",
      titulo: "Provider",
      plural: "Providers",
      ops: porProvider,
      nome: (id) => PROVIDERS.find((p) => p.id === id)?.name ?? id,
      icone: providerIcon,
    },
    // O nome do APP, nunca o id da API: "claude-sonnet-4-6" é como o
    // provider chama; no resto do app ele é "Sonnet 4.6".
    {
      chave: "models",
      titulo: "Model",
      plural: "Models",
      ops: porModelo,
      nome: prettyModelName,
      icone: modelLogo,
    },
    {
      chave: "modes",
      titulo: "Mode",
      plural: "Modes",
      ops: porModo,
      nome: moduleLabel,
      icone: moduleIcon,
    },
  ];
  const visiveis = dimensoes.filter((d) => valeFiltrar(d.ops, f[d.chave]));
  const naLista = dimensoes.find((d) => d.chave === lista) ?? dimensoes[1];
  // O relatório do "See all": o recorte da página MENOS o filtro da própria
  // dimensão (ver semADimensao) — a mesma soma de sempre, só recortada.
  const aggLista = useMemo(
    () => aggregateFromSummaries(aplicar(chats, semADimensao(f, lista)), 0),
    [chats, f, lista]
  );
  const mLista = metricaDa(aggLista.total);
  const achadas = buscarOpcoes(naLista.ops, buscaLista, naLista.nome);
  const relatorio = relatorioDe(
    achadas,
    lista === "providers"
      ? aggLista.byProvider
      : lista === "models"
        ? aggLista.byModel
        : aggLista.byMode,
    aggLista.total
  );
  // De QUÊ é o relatório: o período e os filtros das outras dimensões, que
  // continuam valendo nele. Sem isto, os números da folha não batem com
  // nada que a pessoa consiga apontar.
  const escopo = [
    f.days === 0 ? "All time" : `Last ${f.days} days`,
    ...dimensoes
      .filter((d) => d.chave !== lista)
      .flatMap((d) => f[d.chave].map(d.nome)),
    contagem(aggLista.total.chats),
    mLista === "cost"
      ? formatUsdRounded(aggLista.total.cost)
      : `${formatCompact(aggLista.total.tokensIn + aggLista.total.tokensOut)} tokens`,
  ];

  const verTodos = (d: Dimensao) => {
    setLista(d);
    setBuscaLista("");
    setListaAberta(true);
  };

  const salvarRelatorio = async () => {
    setSalvando(true);
    try {
      // O relatório é do RECORTE, não do vault inteiro: foi o recorte que a
      // pessoa montou, e é dele que ela quer o documento.
      const r = await saveUsageMarkdown(
        plugin.app,
        agg,
        f.days,
        plugin.settings.chatsPath
      );
      new Notice(`Report saved: ${r.path}`);
    } catch (err) {
      console.error("[axxa] salvar report falhou:", err);
      new Notice(
        `Could not save the report: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setSalvando(false);
    }
  };

  const abrir = (c: ChatUsageRow) => {
    void session.load(c);
    onOpenChat();
  };

  const vazio = agg.total.chats === 0;

  return (
    <div className="axxa-chat">
      <header className="axxa-topbar is-bare">
        <button
          type="button"
          className="axxa-icon-btn"
          aria-label="Back"
          onClick={onBack}
        >
          <Icon name="arrow-left" />
        </button>
        <span className="axxa-brand axxa-topbar-brand">Usage</span>
        {/* O relatório é a SAÍDA desta tela, e mora na barra, como o "New"
            das folhas: ele cria uma nota, e no app accent é o que cria.
            Flutuando embaixo, ele cobria justamente a lista que a pessoa
            tinha rolado pra ler. */}
        <button
          type="button"
          className="axxa-topbar-action axxa-topbar-end"
          aria-label="Save this report as a note"
          title="Save this report as a note"
          disabled={salvando || vazio}
          onClick={() => void salvarRelatorio()}
        >
          <Icon name={salvando ? "loader" : "file-down"} size={18} />
          <span>{salvando ? "Saving…" : "Report"}</span>
        </button>
      </header>

      <div className="axxa-messages axxa-home axxa-usage-page">
        {/* O período vem PRIMEIRO: ele é a régua da página inteira — o total,
            a média, os modelos e a lista mudam com ele. */}
        <Segmented
          options={PERIODOS}
          value={String(f.days)}
          label="Period"
          // Período é UM: duas janelas ao mesmo tempo não querem dizer nada.
          onChange={(id) => setF({ ...f, days: Number(id) })}
        />

        {/* A resposta da pergunta que a pessoa acabou de fazer com o
            recorte. */}
        <section className="axxa-usage is-hero" aria-label="Totals">
          <span className="axxa-usage-meta">
            <span className="axxa-usage-big">
              {m === "cost"
                ? formatUsdRounded(agg.total.cost)
                : formatCompact(agg.total.tokensIn + agg.total.tokensOut)}
            </span>
            <span className="axxa-usage-unit">
              {m === "cost" ? "spent" : "tokens"}
            </span>
            {m === "cost" && agg.total.hasUnknownCost && (
              <span
                className="axxa-usage-approx"
                title="Some models have no public price — this is a floor"
              >
                +
              </span>
            )}
          </span>
          {/* Quantas conversas, e ONDE elas caíram: "All time" sozinho não
              diz se o total é de um mês ou de dois anos. */}
          <span className="axxa-usage-sub">
            {agg.total.chats === 1 ? "1 chat" : `${agg.total.chats} chats`}
            {!vazio && (
              <>
                <span className="axxa-usage-sep">·</span>
                {faixaDeDatas(agg.periodStart, agg.periodEnd)}
              </>
            )}
          </span>
          <div className="axxa-mods">
            {/* As setas são as do cartão de projeto: o que SOBE sai daqui
                pro modelo, o que DESCE volta dele. */}
            <Modulo
              icone="arrow-up-from-line"
              rotulo="Sent"
              valor={formatCompact(agg.total.tokensIn)}
              unidade="tokens"
            />
            <Modulo
              icone="arrow-down-to-line"
              rotulo="Received"
              valor={formatCompact(agg.total.tokensOut)}
              unidade="tokens"
            />
            <Modulo
              icone="message-circle"
              rotulo="Per chat"
              valor={
                media == null
                  ? "—"
                  : m === "cost"
                    ? formatUsdRounded(media)
                    : formatCompact(Math.round(media))
              }
              unidade={m === "cost" ? "avg" : "tokens"}
            />
          </div>
        </section>

        {visiveis.length > 0 && (
          <section className="axxa-home-block axxa-usage-filters">
            <div className="axxa-home-headrow">
              <span className="axxa-section-label">Filter</span>
              {/* Limpa os filtros de LISTA; o período fica — ele tem o
                  seletor dele, lá em cima, e não é isto que o botão diz. */}
              {marcados(f) > 0 && (
                <button
                  type="button"
                  className="axxa-home-filter is-accent"
                  onClick={() => setF({ ...FILTRO_VAZIO, days: f.days })}
                >
                  <Icon name="x" size={16} />
                  <span>Clear</span>
                </button>
              )}
            </div>
            {visiveis.map((d) => (
              <div key={d.chave} className="axxa-usage-dim">
                {/* As TRÊS mais usadas à vista; o resto mora na lista do "See
                    all" — o mesmo "See all N ›" da home, na linha do nome. */}
                <div className="axxa-usage-dim-head">
                  <span className="axxa-usage-dim-label">{d.titulo}</span>
                  {d.ops.length > A_VISTA && (
                    <button
                      type="button"
                      className="axxa-home-filter is-accent"
                      onClick={() => verTodos(d.chave)}
                    >
                      <span>See all {d.ops.length}</span>
                      <Icon name="chevron-right" size={16} />
                    </button>
                  )}
                </div>
                <div className="axxa-choices" role="group" aria-label={d.titulo}>
                  {opcoesAVista(d.ops, f[d.chave]).map((o) => {
                    const on = f[d.chave].includes(o.id);
                    const nome = d.nome(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        className={on ? "axxa-choice is-on" : "axxa-choice"}
                        aria-pressed={on}
                        // Lido em voz alta, "GPT 5 13" não diz o que é o 13.
                        aria-label={`${nome}, ${contagem(o.count)}`}
                        onClick={() =>
                          setF({ ...f, [d.chave]: alternar(f[d.chave], o.id) })
                        }
                      >
                        <Icon name={d.icone(o.id)} size={16} />
                        <span>{nome}</span>
                        <sup className="axxa-choice-count" aria-hidden="true">
                          {o.count}
                        </sup>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}

        {vazio ? (
          <div className="axxa-home-empty">
            <Icon name="chart-no-axes-column" size={42} />
            <p>
              {chats.length === 0
                ? "No usage yet. Every chat is counted here as you go."
                : "Nothing in this slice. Try a longer period or fewer filters."}
            </p>
          </div>
        ) : (
          <>
            {/* "O caro é qual?", sem abrir conversa nenhuma. */}
            <section className="axxa-home-block">
              <span className="axxa-section-label">By model</span>
              <div className="axxa-usage-list">
                {modelos.map((r) => (
                  <LinhaDeFatia
                    key={r.id}
                    r={r}
                    m={m}
                    nome={prettyModelName(r.id)}
                    icone={modelLogo(r.id)}
                  />
                ))}
              </div>
            </section>

            <section className="axxa-home-block">
              <span className="axxa-section-label">
                {m === "cost" ? "Most expensive chats" : "Biggest chats"}
              </span>
              <div className="axxa-usage-list">
                {topo.map((c) => (
                  <LinhaDeConversa
                    key={c.id}
                    c={c}
                    m={m}
                    onOpen={() => abrir(c)}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {/* O "See all" é um RELATÓRIO da dimensão inteira, não um seletor: as
          mesmas linhas do "By model" (o anel da fatia, conversas, tokens,
          valor e %), sem check e sem nada com cara de toque. Filtrar é nas
          pílulas; aqui se lê. */}
      <Sheet
        title={naLista.plural}
        open={listaAberta}
        onClose={() => setListaAberta(false)}
      >
        {naLista.ops.length > BUSCA_A_PARTIR && (
          <SheetSearch
            value={buscaLista}
            placeholder={`Search ${naLista.plural.toLowerCase()}`}
            found={achadas.length}
            onChange={setBuscaLista}
          />
        )}
        <p className="axxa-usage-report-head">
          {escopo.map((parte, i) => (
            <span key={i}>
              {i > 0 && <span className="axxa-usage-sep">·</span>}
              {parte}
            </span>
          ))}
        </p>
        {achadas.length === 0 ? (
          <SheetNote>Nothing matches that search.</SheetNote>
        ) : (
          <div className="axxa-usage-list">
            {relatorio.usadas.map((r) => (
              <LinhaDeFatia
                key={r.id}
                r={r}
                m={mLista}
                nome={naLista.nome(r.id)}
                icone={naLista.icone(r.id)}
              />
            ))}
            {relatorio.paradas.map((o) => (
              <LinhaParada
                key={o.id}
                nome={naLista.nome(o.id)}
                icone={naLista.icone(o.id)}
              />
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/** "1 chat", "13 chats". */
function contagem(n: number): string {
  return n === 1 ? "1 chat" : `${n} chats`;
}

/**
 * Uma linha de relatório: o anel da fatia com o logo dentro, o nome, e o
 * valor na ponta. É a do "By model" e a do "See all" de qualquer dimensão.
 *
 * Sem dinheiro na página, o valor vira o volume — e o preço desce pra linha
 * de apoio, onde "free" e "no public price" continuam distintos.
 */
function LinhaDeFatia({
  r,
  m,
  nome,
  icone,
}: {
  r: Fatia;
  m: Metrica;
  /** O nome do APP ("Sonnet 4.6", "OpenAI", "Vault Q&A"). */
  nome: string;
  icone: string;
}) {
  const chats = contagem(r.chats);
  const preco =
    r.preco === "gratis" ? "Free" : r.preco === "sem-preco" ? "—" : formatUsd(r.cost);
  return (
    <div className="axxa-usage-row">
      <span
        className="axxa-share"
        style={{ "--axxa-pct": r.pct } as CSSProperties}
        aria-hidden="true"
      >
        <span className="axxa-donut" />
        <Icon name={icone} size={16} />
      </span>
      <span className="axxa-usage-row-text">
        <span className="axxa-usage-row-name">{nome}</span>
        <span className="axxa-usage-row-sub">
          {chats}
          <span className="axxa-usage-sep">·</span>
          {m === "cost"
            ? `${formatCompact(r.tokens)} tokens`
            : r.preco === "sem-preco"
              ? "no public price"
              : "free"}
        </span>
      </span>
      <span className="axxa-usage-row-end">
        <span
          className="axxa-usage-row-value"
          title={r.preco === "sem-preco" ? "No public price" : undefined}
        >
          {m === "cost" ? preco : formatCompact(r.tokens)}
          {r.piso && <span className="axxa-usage-approx">+</span>}
        </span>
        <span className="axxa-usage-row-pct">
          {r.quase ? "<1%" : `${r.pct}%`}
        </span>
      </span>
    </div>
  );
}

/**
 * Uma opção SEM conversa no recorte — no relatório mesmo assim, no fim e
 * apagada: "usei esse modelo, só não nesse período" também é informação, e
 * sem ela a lista não bateria com o "See all N" que a abriu.
 */
function LinhaParada({ nome, icone }: { nome: string; icone: string }) {
  return (
    <div className="axxa-usage-row is-idle">
      <span
        className="axxa-share"
        style={{ "--axxa-pct": 0 } as CSSProperties}
        aria-hidden="true"
      >
        <span className="axxa-donut" />
        <Icon name={icone} size={16} />
      </span>
      <span className="axxa-usage-row-text">
        <span className="axxa-usage-row-name">{nome}</span>
        <span className="axxa-usage-row-sub">No chats in this slice</span>
      </span>
      <span className="axxa-usage-row-end">
        <span className="axxa-usage-row-value">—</span>
      </span>
    </div>
  );
}

/**
 * Uma conversa da lista do topo — o mesmo desenho do cartão de conversa da
 * home (logo do provider, título, apoio, a ponta à direita), e abre do mesmo
 * jeito: lista de conversa que não abre a conversa é uma armadilha.
 */
function LinhaDeConversa({
  c,
  m,
  onOpen,
}: {
  c: ChatUsageRow;
  m: Metrica;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="axxa-usage-row" onClick={onOpen}>
      <span className="axxa-card-mark" aria-hidden="true">
        <Icon name={providerIcon(c.provider)} size={20} />
      </span>
      <span className="axxa-usage-row-text">
        <span className="axxa-usage-row-name">{c.title || "Untitled"}</span>
        <span className="axxa-usage-row-sub">
          {prettyModelName(c.model)}
          <span className="axxa-usage-sep">·</span>
          {moduleLabel(c.mode)}
        </span>
      </span>
      <span className="axxa-usage-row-end">
        <span className="axxa-usage-row-value">
          {m === "tokens"
            ? formatCompact(c.tokensIn + c.tokensOut)
            : c.cost === 0
              ? "Free"
              : formatUsd(c.cost)}
        </span>
        <span className="axxa-usage-row-pct">{relativeShort(c.date)}</span>
      </span>
    </button>
  );
}

/**
 * Um módulo — o do cartão da home, com um ícone no rótulo: aqui os três são
 * parentes (entra, sai, média), e é o desenho que diz qual é qual antes da
 * palavra.
 */
function Modulo({
  icone,
  rotulo,
  valor,
  unidade,
}: {
  icone: string;
  rotulo: string;
  valor: string;
  unidade: string;
}) {
  return (
    <div className="axxa-mod">
      <span className="axxa-mod-title has-icon">
        <Icon name={icone} size={12} />
        <span>{rotulo}</span>
      </span>
      <span className="axxa-mod-row">
        <span className="axxa-mod-value">{valor}</span>
        <span className="axxa-mod-unit">{unidade}</span>
      </span>
    </div>
  );
}
