// src/ui/AssistantPanel.tsx
// A ASSISTENTE dentro do formulário — o "escreve pra mim".
//
// Ela mora DENTRO do formulário, acima dos campos, e não numa tela própria. A
// razão é o que acontece depois: a assistente não salva nada, ela PREENCHE. O
// resultado aparece nos mesmos campos que a pessoa já estava olhando, e ela
// edita o que quiser antes de salvar. Numa tela separada, o resultado chegaria
// como um fato consumado; aqui chega como um rascunho.
//
// Três coisas a separam do resto do app, e as três são de propósito:
//
// 1. ELA TEM CARA PRÓPRIA. Tudo no app é superfície neutra tirada do tema do
//    Obsidian. Esta caixa é a única em accent, com a borda acesa e um brilho no
//    topo. Não é enfeite: ela é o único lugar da tela onde o texto não foi
//    escrito por você nem pelo app — foi escrito por um modelo. Quem olha de
//    relance precisa saber disso sem ler nada.
//
// 2. ELA PERGUNTA COM PASTILHAS. Responder três perguntas por escrito num
//    celular é trabalho; tocar em três pastilhas é um gesto. O campo continua
//    ali pra quem quiser dizer outra coisa — as opções são atalho, não gaiola.
//
// 3. ELA NÃO PARA QUANDO VOCÊ SAI. O estado da rodada vive fora do React (ver
//    assistant/store.ts): fechar o painel, a folha ou trocar de nível não
//    cancela nada. Num modelo free uma volta leva de cinco a vinte segundos, e
//    ninguém fica olhando um botão por vinte segundos.

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "./Icon";
import { useSheetFull } from "./Sheet";
import { openActions } from "./menu";
import { ThinkingGlyph, ThinkingInline } from "./Thinking";
import { prettyModelName } from "../providers/modelDescriptions";
import {
  assinar,
  comecarRodada,
  lerRun,
  limparRun,
  type Rodada,
} from "../assistant/store";
import type { ModoAssistente } from "../assistant/prompt";
import type { TurnoAssistente } from "../assistant/run";

// O nome do modelo é o NOSSO, nunca o da API.
//
// Eu tinha escrito um encurtador aqui — tirava o vendor e o `:free` e pronto.
// Era um segundo jeito de escrever a mesma coisa: o app já tem
// `prettyModelName`, que é o que aparece na pílula do composer e na folha de
// modelos. Dois jeitos significam que um dia eles divergem, e aí o mesmo
// modelo tem dois nomes em duas telas do mesmo app.

export type AlvoAssistente =
  | "skill"
  | "project"
  | "description"
  | "instructions";

export interface AssistantPanelProps {
  /** O que a assistente vai montar — muda o convite, o exemplo e a CHAVE da
   *  rodada no store (uma por tipo; ver store.ts). */
  para: AlvoAssistente;
  /** null = pronta. Com texto, o painel só explica o que falta. */
  indisponivel: string | null;
  /** Faz a chamada. O painel não espera por ela — quem espera é o store. */
  onPedir: (modo: ModoAssistente, turnos: TurnoAssistente[]) => Promise<Rodada>;
  /** Fecha o painel. */
  onFechar: () => void;
  /** Quem está escrevendo, e como trocar — aqui mesmo. */
  modelo?: {
    atual: string;
    opcoes: string[];
    onTrocar: (model: string) => void;
  };
}

const CONVITE: Record<AlvoAssistente, string> = {
  skill: "Describe the skill you want, in a line.",
  project: "What is this project about?",
  description: "Anything to steer it? (optional)",
  instructions: "Anything to steer it? (optional)",
};

const EXEMPLO: Record<AlvoAssistente, string> = {
  skill: "A weekly review that reads my notes and tells me what stalled",
  project: "My master's thesis on Kuhn and scientific revolutions",
  description: "Optional — it writes from the prompt above",
  instructions: "Optional — it writes from the project and its notes",
};

/**
 * Onde o contexto JÁ está na tela, escrever não depende de digitar nada: o
 * prompt do skill e as notas do projeto são a entrada. Nestes o botão nasce
 * ligado, e o campo vira ajuste fino em vez de requisito.
 */
const PARTE_DO_VAZIO: Record<AlvoAssistente, boolean> = {
  skill: false,
  project: false,
  description: true,
  instructions: true,
};

/** Lê a rodada do store e re-renderiza quando ela muda. */
export function useRun(chave: string) {
  return useSyncExternalStore(
    (f) => assinar(chave, f),
    () => lerRun(chave)
  );
}

export function AssistantPanel({
  para,
  indisponivel,
  onPedir,
  onFechar,
  modelo,
}: AssistantPanelProps) {
  // A folha vai pro tamanho grande: o painel abre ABAIXO do campo, e num campo
  // que já estava no meio da tela ele nasce atrás do rodapé — a pessoa toca no
  // botão e o que aparece é meia caixa cortada.
  useSheetFull();

  const run = useRun(para);
  const [texto, setTexto] = useState("");
  const ocupado = run.fase === "rodando";
  const partirDoVazio = PARTE_DO_VAZIO[para];
  const perguntando = run.fase === "perguntando";

  /** Manda uma resposta — do campo ou de uma pastilha. */
  const responder = (dito: string, modo: ModoAssistente) => {
    if (ocupado) return;
    const limpo = dito.trim();
    if (!limpo && !partirDoVazio && !perguntando) return;
    const proximos: TurnoAssistente[] = limpo
      ? [...run.turnos, { quem: "pessoa", texto: limpo }]
      : run.turnos;
    setTexto("");
    // Dispara e esquece: o resultado chega pelo store, e o store sobrevive a
    // este componente sair da tela.
    comecarRodada(para, proximos, (t) => onPedir(modo, t));
  };

  const cabecalho = (
    <div className="axxa-assist-head">
      <Icon name="sparkles" size={16} />
      <span>Write it for me</span>
      {/* Quem escreve, e a troca — no lugar onde se percebe que precisa
          trocar. */}
      {modelo && modelo.opcoes.length > 1 && (
        <button
          type="button"
          className="axxa-assist-modelo"
          title={`Writing with ${modelo.atual}`}
          onClick={(e) =>
            openActions(
              e as unknown as MouseEvent,
              modelo.opcoes.map((m) => ({
                label: prettyModelName(m),
                icon: m.endsWith(":free") ? "gift" : "credit-card",
                checked: m === modelo.atual,
                run: () => modelo.onTrocar(m),
              }))
            )
          }
        >
          <span>{prettyModelName(modelo.atual)}</span>
          <Icon name="chevron-down" size={14} />
        </button>
      )}
      <button
        type="button"
        className="axxa-icon-btn"
        aria-label="Close"
        onClick={() => {
          // Fechar não cancela: o que está a caminho continua e o resultado
          // espera o formulário. Só a pergunta pendente some junto — ela só
          // faz sentido com o painel aberto.
          if (run.fase !== "rodando") limparRun(para);
          onFechar();
        }}
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );

  if (indisponivel)
    return (
      <div className="axxa-assist">
        {cabecalho}
        <p className="axxa-assist-note">{indisponivel}</p>
      </div>
    );

  return (
    <div className={perguntando ? "axxa-assist is-grill" : "axxa-assist"}>
      {cabecalho}

      {/* A pergunta dela é FALA, não rótulo: sem caixa, no tamanho do texto —
          o que vem abaixo é a resposta. */}
      {perguntando && <p className="axxa-assist-ask">{run.pergunta}</p>}

      {/* As pastilhas: a resposta em um toque. Elas mandam NA HORA, sem passar
          pelo campo — parar pra digitar depois de escolher seria cobrar duas
          vezes pela mesma decisão. */}
      {perguntando && run.opcoes.length > 0 && (
        <div className="axxa-assist-opcoes">
          {run.opcoes.map((o) => (
            <button
              key={o}
              type="button"
              className="axxa-assist-opcao"
              disabled={ocupado}
              onClick={() => responder(o, "guiado")}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      <div className="axxa-assist-box">
        <textarea
          className="axxa-assist-campo"
          value={texto}
          rows={perguntando ? 2 : 3}
          placeholder={perguntando ? "Or say it your way…" : EXEMPLO[para]}
          aria-label={perguntando ? run.pergunta : CONVITE[para]}
          disabled={ocupado}
          onChange={(e) => setTexto(e.currentTarget.value)}
        />
        <div className="axxa-assist-acoes">
          {/* Enquanto escreve, a fileira de ações dá lugar à ESPERA — a mesma
              das conversas: o asterisco que respira, o relógio e o verbo que
              troca. Um botão desligado escrito "Writing…" não diz há quanto
              tempo, e é essa a única pergunta de quem espera. */}
          {ocupado ? (
            <ThinkingInline since={run.inicio} />
          ) : (
            <>
              {/* O guiado some depois da primeira pergunta: a conversa já está
                  acontecendo, e dois botões ali só ofereceriam sair dela pelo
                  meio. */}
              {!perguntando && !partirDoVazio && (
                <button
                  type="button"
                  className="axxa-assist-guiado"
                  disabled={!texto.trim()}
                  onClick={() => responder(texto, "guiado")}
                >
                  <Icon name="message-circle-question" size={15} />
                  <span>Grill me</span>
                </button>
              )}
              <button
                type="button"
                className="axxa-assist-cta"
                disabled={!texto.trim() && !partirDoVazio && !perguntando}
                onClick={() =>
                  responder(texto, perguntando ? "guiado" : "direto")
                }
              >
                <Icon name="sparkles" size={16} />
                <span>{perguntando ? "Send" : "Write it"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Que dá pra sair só é dito ENQUANTO ela escreve: no resto do tempo
          seria papel de parede. */}
      {ocupado && (
        <p className="axxa-assist-note">
          <Icon name="check" size={14} />
          <span>You can close this — it keeps writing.</span>
        </p>
      )}

      {run.fase === "erro" && (
        <p className="axxa-assist-erro" role="status">
          <Icon name="info" size={14} />
          <span>{run.erro}</span>
        </p>
      )}
    </div>
  );
}

/**
 * O convite, DENTRO do campo que ele preenche.
 *
 * Era uma pílula solta acima do formulário, e ali ela era mais um item da
 * pilha: a pessoa lia "Write it for me", "Name", "Prompt" como três coisas do
 * mesmo nível. Dentro do campo, ela vira o que é — uma oferta sobre AQUELE
 * espaço vazio, no lugar onde o olho já está quando percebe que não sabe o que
 * escrever. É o mesmo lugar em que a lupa mora numa busca.
 *
 * `onMouseDown` com `preventDefault` porque o campo pode estar com o foco: sem
 * isso o toque tira o cursor de lá antes do clique, e num celular isso fecha o
 * teclado — a tela inteira salta no instante em que se toca no botão.
 */
export function AssistantSpark({
  onClick,
  titulo = "Write it for me",
  ocupado,
}: {
  onClick: () => void;
  titulo?: string;
  /** Uma rodada deste campo está rodando em algum lugar — o ícone gira, pra
   *  quem fechou o painel saber que ainda tem coisa vindo. */
  ocupado?: boolean;
}) {
  const rotulo = ocupado ? `${titulo} — writing…` : titulo;
  return (
    <button
      type="button"
      className={ocupado ? "axxa-assist-spark is-busy" : "axxa-assist-spark"}
      aria-label={rotulo}
      title={rotulo}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {/* O mesmo glifo das conversas: quem fechou o painel vê no campo o
          mesmo desenho que veria se tivesse ficado. */}
      {ocupado ? <ThinkingGlyph /> : <Icon name="sparkles" size={16} />}
    </button>
  );
}

/**
 * O campo com o botão dentro.
 *
 * `position: relative` no invólucro e o botão por cima; o respiro pra ele vem
 * de uma classe no próprio campo (ver `.axxa-has-spark`), senão o texto passa
 * por baixo do botão exatamente quando fica comprido.
 */
export function ComAssistente({
  children,
  aberto,
  onAbrir,
  painel,
  ocupado,
}: {
  children: ReactNode;
  aberto: boolean;
  onAbrir: () => void;
  /** O painel, renderizado LOGO ABAIXO do campo quando aberto. */
  painel: ReactNode;
  ocupado?: boolean;
}) {
  return (
    <>
      <span className="axxa-spark-wrap">
        {children}
        {!aberto && <AssistantSpark onClick={onAbrir} ocupado={ocupado} />}
      </span>
      {aberto && painel}
    </>
  );
}
