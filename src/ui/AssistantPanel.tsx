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
// 1. ELA É UM MODAL ACIMA DO TECLADO, SEMPRE. Não é um bloco no meio do
//    formulário: enquanto era, ela nascia onde o campo estava — às vezes no
//    meio da tela, às vezes atrás do rodapé, e com o teclado aberto quase
//    sempre embaixo dele. Aqui ela encosta na base e sobe junto com o teclado
//    (`--keyboard-height`), como o cartão de renomear. O que ela pede é o que
//    se digita; tem que estar onde o dedo já está.
//
// 2. ELA TEM CARA PRÓPRIA. Tudo no app é superfície neutra tirada do tema do
//    Obsidian. Esta caixa é a única em accent, com a borda acesa e um brilho no
//    topo. Não é enfeite: ela é o único lugar da tela onde o texto não foi
//    escrito por você nem pelo app — foi escrito por um modelo. Quem olha de
//    relance precisa saber disso sem ler nada.
//
// 3. ELA PERGUNTA COM PASTILHAS. Responder três perguntas por escrito num
//    celular é trabalho; tocar em três pastilhas é um gesto. O campo continua
//    ali pra quem quiser dizer outra coisa — as opções são atalho, não gaiola.
//
// 4. ELA NÃO PARA QUANDO VOCÊ SAI. O estado da rodada vive fora do React (ver
//    assistant/store.ts): fechar o painel, a folha ou trocar de nível não
//    cancela nada. Num modelo free uma volta leva de cinco a vinte segundos, e
//    ninguém fica olhando um botão por vinte segundos.

import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { openActions } from "./menu";
import { ThinkingGlyph, ThinkingInline } from "./Thinking";
import { prettyModelName } from "../providers/modelDescriptions";
import { modelLogo } from "../providers/modelLogo";
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
    /** Quais da lista são grátis — a etiqueta sai daqui. */
    livres?: string[];
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

/**
 * QUANTO do viewport de layout o teclado está cobrindo, medido — não
 * adivinhado.
 *
 * A primeira tentativa somou `--keyboard-height` direto no padding, e o cartão
 * foi parar ACIMA do topo da tela. O motivo: nesse aparelho a viewport JÁ
 * encolhe quando o teclado abre, então o `fixed` já vinha limitado à parte de
 * cima — e a gente subtraía o teclado uma segunda vez.
 *
 * `visualViewport` resolve os dois casos com uma conta só, porque ele descreve
 * o que está REALMENTE visível:
 *   - viewport que encolhe → `innerHeight` também encolheu → a sobra dá 0, e o
 *     cartão fica onde já estava certo;
 *   - viewport que não encolhe (o teclado entra por cima) → a sobra é a altura
 *     do teclado, e o cartão sobe exatamente isso.
 * Um valor fixo nunca acertaria os dois; medir acerta sem saber qual é.
 */
export function useTecladoGap(): number {
  const [gap, setGap] = useState(0);
  useLayoutEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const medir = () =>
      setGap(Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop))));
    medir();
    vv.addEventListener("resize", medir);
    vv.addEventListener("scroll", medir);
    return () => {
      vv.removeEventListener("resize", medir);
      vv.removeEventListener("scroll", medir);
    };
  }, []);
  return gap;
}

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
  const run = useRun(para);
  const tecladoGap = useTecladoGap();
  const [texto, setTexto] = useState("");
  /**
   * A pessoa escolheu a quarta pastilha ("Let me type") nesta pergunta.
   *
   * Enquanto ela não escolhe, o campo de texto nem aparece: depois da frase do
   * objetivo, o interrogatório é de TOQUE. Um campo aberto ao lado das
   * pastilhas transforma cada pergunta numa redação opcional — e quem está no
   * celular responde a redação, porque ela parece o caminho "certo".
   */
  const [digitando, setDigitando] = useState(false);
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
    setDigitando(false);
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
              // O logo de QUEM FEZ o modelo, não um símbolo de preço: numa
              // lista de nomes parecidos, a marca é o que se acha com o olho.
              // O grátis continua dito — na etiqueta, onde é informação e não
              // identidade.
              modelo.opcoes.map((m) => ({
                label: modelo.livres?.includes(m)
                  ? `${prettyModelName(m)} · free`
                  : prettyModelName(m),
                icon: modelLogo(m),
                checked: m === modelo.atual,
                run: () => modelo.onTrocar(m),
              }))
            )
          }
        >
          <Icon name={modelLogo(modelo.atual)} size={14} />
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

  /**
   * A camada sai da FOLHA por um portal, e isto não é arrumação de código.
   *
   * `.axxa-sheet` tem `transform` e `will-change: transform` — e um ancestral
   * transformado vira o bloco de contenção de todo `position: fixed` que
   * estiver dentro dele. O modal, sendo filho do formulário, não era fixo à
   * TELA: era fixo à folha, e ainda por cima recortado pelo `overflow: hidden`
   * da camada dela. No preview isso passou despercebido porque a folha estava
   * grande e o fundo dela coincidia com o fundo da tela; no aparelho, com a
   * folha em 62%, o modal nascia atrás do rodapé — invisível.
   *
   * É a mesma armadilha que fazia o teclado ser ignorado: preso à folha, a
   * conta de `--keyboard-height` (que é sobre a tela) não queria dizer nada.
   *
   * O portal leva a camada pra `.axxa-root`, que não tem transform nenhum —
   * então `fixed` volta a ser fixo de verdade, e o CSS continua no escopo
   * `.axxa-root` de sempre.
   */
  const ancora = useRef<HTMLSpanElement>(null);
  const [raiz, setRaiz] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setRaiz(ancora.current?.closest<HTMLElement>(".axxa-root") ?? null);
  }, []);

  const camada = (dentro: ReactNode) => {
    const layer = (
      <div
        className="axxa-assist-layer"
        // A folga vem MEDIDA (ver useTecladoGap), não de uma variável: somar
        // `--keyboard-height` onde a viewport já encolheu joga o cartão pra
        // fora do topo da tela.
        style={{ paddingBottom: `calc(${tecladoGap}px + var(--axxa-fundo))` }}
      >
        {/* Tocar fora fecha — mas não cancela o que está a caminho (ver o X). */}
        <div
          className="axxa-scrim"
          onClick={() => {
            if (run.fase !== "rodando") limparRun(para);
            onFechar();
          }}
        />
        {dentro}
      </div>
    );
    return (
      <>
        {/* A âncora fica na árvore original só pra achar a raiz — ela não
            desenha nada. */}
        <span ref={ancora} hidden />
        {raiz ? createPortal(layer, raiz) : null}
      </>
    );
  };

  if (indisponivel)
    return camada(
      <div className="axxa-assist">
        {cabecalho}
        <p className="axxa-assist-note">{indisponivel}</p>
      </div>
    );

  return camada(
    <div className={perguntando ? "axxa-assist is-grill" : "axxa-assist"}>
      {cabecalho}

      {/* A pergunta dela é FALA, não rótulo: sem caixa, no tamanho do texto —
          o que vem abaixo é a resposta. */}
      {perguntando && <p className="axxa-assist-ask">{run.pergunta}</p>}

      {/* As pastilhas: a resposta em um toque. Elas mandam NA HORA, sem passar
          pelo campo — parar pra digitar depois de escolher seria cobrar duas
          vezes pela mesma decisão.
          Três dela e uma NOSSA. A quarta é a saída, e existe em toda pergunta
          com o mesmo texto e no mesmo lugar: saída que muda de nome e de
          posição não é saída. */}
      {perguntando && !digitando && (
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
          <button
            type="button"
            className="axxa-assist-opcao is-escrever"
            disabled={ocupado}
            onClick={() => setDigitando(true)}
          >
            <Icon name="pencil" size={14} />
            <span>Let me type</span>
          </button>
        </div>
      )}

      {/* A caixa só aparece quando é ela que responde: na frase do OBJETIVO
          (antes da primeira pergunta) e quando a pessoa pede pra digitar. */}
      {(!perguntando || digitando) && (
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
              {/* Voltar pras pastilhas: escolher "eu escrevo" e mudar de ideia
                  não pode ser um beco. */}
              {digitando && (
                <button
                  type="button"
                  className="axxa-assist-guiado"
                  onClick={() => {
                    setDigitando(false);
                    setTexto("");
                  }}
                >
                  <Icon name="chevron-left" size={15} />
                  <span>Options</span>
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
      )}

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
