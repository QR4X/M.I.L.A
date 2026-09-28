// src/ui/AssistantPanel.tsx
// O painel da ASSISTENTE dentro do formulário — o "escreve pra mim".
//
// Ele mora DENTRO do formulário, acima dos campos, e não numa tela própria. A
// razão é o que acontece depois: a assistente não salva nada, ela PREENCHE. O
// resultado aparece nos mesmos campos que a pessoa já estava olhando, e ela
// edita o que quiser antes de salvar. Numa tela separada, o resultado chegaria
// como um fato consumado; aqui chega como um rascunho.
//
// Dois humores, porque as duas perguntas existem:
//   - "escrevo em uma linha o que quero" → uma volta, campos preenchidos.
//   - "não sei bem o que quero" → ela pergunta até três coisas e então escreve.
// O mesmo endpoint serve aos dois: o modelo devolve `{"ask": …}` ou
// `{"draft": …}`, e quem decide quando tem o bastante é ele (ver prompt.ts).

import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { useSheetFull } from "./Sheet";
import { openActions } from "./menu";

/**
 * O nome do modelo do jeito que cabe numa linha de painel.
 *
 * Sai o vendor e sai o `:free` — o primeiro é ruído (são todos do mesmo
 * provider aqui) e o segundo já é dito pelo ícone do menu.
 */
function nomeCurto(id: string): string {
  return (id.split("/").pop() ?? id).replace(/:free$/, "");
}
import type { ModoAssistente } from "../assistant/prompt";
import type { TurnoAssistente } from "../assistant/run";

export interface AssistantPanelProps {
  /** O que a assistente vai montar — muda o convite e o exemplo. */
  para: "skill" | "project" | "description" | "instructions";
  /** null = pronta. Com texto, o painel só explica o que falta. */
  indisponivel: string | null;
  /**
   * Faz a chamada. Devolve a pergunta seguinte, ou nada (quando aplicou o
   * rascunho — aí quem manda fechar é o pai, via `onPronto`).
   */
  onPedir: (
    modo: ModoAssistente,
    turnos: TurnoAssistente[]
  ) => Promise<{ pergunta?: string; erro?: string; pronto?: boolean }>;
  /** Fecha o painel. */
  onFechar: () => void;
  /**
   * Quem está escrevendo, e como trocar — aqui mesmo.
   *
   * O motivo mais comum pra querer outro modelo é o resultado que acabou de
   * aparecer: texto ruim, ou no idioma errado. Mandar a pessoa pras settings
   * nesse momento é fazê-la perder o que estava escrito e o lugar onde
   * estava.
   */
  modelo?: {
    atual: string;
    opcoes: string[];
    onTrocar: (model: string) => void;
  };
}

const CONVITE = {
  skill: "Describe the skill you want, in a line.",
  project: "What is this project about?",
  description: "Anything to steer it? (optional)",
  instructions: "Anything to steer it? (optional)",
};

const EXEMPLO = {
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
const PARTE_DO_VAZIO: Record<string, boolean> = {
  description: true,
  instructions: true,
};

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

  const [texto, setTexto] = useState("");
  const [turnos, setTurnos] = useState<TurnoAssistente[]>([]);
  /** A pergunta na tela, no modo guiado. */
  const [pergunta, setPergunta] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const partirDoVazio = !!PARTE_DO_VAZIO[para];

  const pedir = async (modo: ModoAssistente) => {
    const dito = texto.trim();
    if ((!dito && !partirDoVazio) || ocupado) return;
    setOcupado(true);
    setErro("");
    // O que a pessoa acabou de dizer entra na conversa ANTES da chamada: no
    // modo guiado, a resposta dela à pergunta anterior é o turno novo.
    const proximos: TurnoAssistente[] = dito
      ? [...turnos, { quem: "pessoa", texto: dito }]
      : turnos;
    const r = await onPedir(modo, proximos);
    setOcupado(false);
    if (r.erro) {
      setErro(r.erro);
      return;
    }
    if (r.pergunta) {
      // Guarda a pergunta dela também: sem isso, na rodada seguinte o modelo
      // não sabe o que perguntou e repete.
      setTurnos([...proximos, { quem: "assistente", texto: r.pergunta }]);
      setPergunta(r.pergunta);
      setTexto("");
      return;
    }
    if (r.pronto) onFechar();
  };

  if (indisponivel)
    return (
      <div className="axxa-assist">
        <div className="axxa-assist-head">
          <Icon name="sparkles" size={16} />
          <span>Write it for me</span>
          <button
            type="button"
            className="axxa-icon-btn"
            aria-label="Close"
            onClick={onFechar}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <p className="axxa-assist-note">{indisponivel}</p>
      </div>
    );

  return (
    <div className="axxa-assist">
      <div className="axxa-assist-head">
        <Icon name="sparkles" size={16} />
        <span>Write it for me</span>
        {/* Quem escreve, e a troca — no lugar onde se percebe que precisa
            trocar. O nome é o do modelo sem o vendor: numa linha de painel,
            "meta-llama/llama-3.3-70b-instruct:free" é uma parede. */}
        {modelo && modelo.opcoes.length > 1 && (
          <button
            type="button"
            className="axxa-assist-modelo"
            title={`Writing with ${modelo.atual}`}
            onClick={(e) =>
              openActions(
                e as unknown as MouseEvent,
                modelo.opcoes.map((m) => ({
                  label: nomeCurto(m),
                  icon: m.endsWith(":free") ? "gift" : "credit-card",
                  checked: m === modelo.atual,
                  run: () => modelo.onTrocar(m),
                }))
              )
            }
          >
            <span>{nomeCurto(modelo.atual)}</span>
            <Icon name="chevron-down" size={14} />
          </button>
        )}
        <button
          type="button"
          className="axxa-icon-btn"
          aria-label="Close"
          onClick={onFechar}
        >
          <Icon name="x" size={16} />
        </button>
      </div>

      {/* A pergunta dela fica ACIMA do campo, como uma fala: no modo guiado o
          campo deixa de ser "descreva" e passa a ser "responda". */}
      {pergunta && <p className="axxa-assist-ask">{pergunta}</p>}

      {/* Os botões moram DENTRO da caixa de texto, como no composer do chat:
          fora dela eles viravam uma terceira fileira de coisas soltas num
          formulário que já tem campos e rótulos empilhados — e um "Write it"
          solto no meio da pilha não se lê como o fim daquela caixa. */}
      <div className="axxa-assist-box">
        <textarea
          className="axxa-assist-campo"
          value={texto}
          rows={3}
          placeholder={pergunta ? "Your answer…" : EXEMPLO[para]}
          aria-label={pergunta || CONVITE[para]}
          disabled={ocupado}
          onChange={(e) => setTexto(e.currentTarget.value)}
        />
        <div className="axxa-assist-acoes">
          {/* O guiado some depois da primeira pergunta: a conversa já está
              acontecendo, e dois botões ali só ofereceriam sair dela pelo
              meio. */}
          {!pergunta && !partirDoVazio && (
            <button
              type="button"
              className="axxa-assist-guiado"
              disabled={ocupado || !texto.trim()}
              onClick={() => void pedir("guiado")}
            >
              <Icon name="message-circle-question" size={15} />
              <span>Ask me questions</span>
            </button>
          )}
          <button
            type="button"
            className="axxa-assist-cta"
            disabled={ocupado || (!texto.trim() && !partirDoVazio)}
            onClick={() => void pedir(pergunta ? "guiado" : "direto")}
          >
            <Icon name={ocupado ? "loader" : "sparkles"} size={16} />
            <span>{ocupado ? "Writing…" : pergunta ? "Send" : "Write it"}</span>
          </button>
        </div>
      </div>

      {erro && (
        <p className="axxa-assist-erro" role="status">
          <Icon name="info" size={14} />
          <span>{erro}</span>
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
}: {
  onClick: () => void;
  titulo?: string;
}) {
  return (
    <button
      type="button"
      className="axxa-assist-spark"
      aria-label={titulo}
      title={titulo}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      <Icon name="sparkles" size={16} />
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
}: {
  children: ReactNode;
  aberto: boolean;
  onAbrir: () => void;
  /** O painel, renderizado LOGO ABAIXO do campo quando aberto. */
  painel: ReactNode;
}) {
  return (
    <>
      <span className="axxa-spark-wrap">
        {children}
        {!aberto && <AssistantSpark onClick={onAbrir} />}
      </span>
      {aberto && painel}
    </>
  );
}
