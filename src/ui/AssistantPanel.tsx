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

import { useState } from "react";
import { Icon } from "./Icon";
import type { ModoAssistente } from "../assistant/prompt";
import type { TurnoAssistente } from "../assistant/run";

export interface AssistantPanelProps {
  /** O que a assistente vai montar — muda só o texto de convite. */
  para: "skill" | "project";
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
}

const CONVITE = {
  skill: "Describe the skill you want, in a line.",
  project: "What is this project about?",
};

const EXEMPLO = {
  skill: "A weekly review that reads my notes and tells me what stalled",
  project: "My master's thesis on Kuhn and scientific revolutions",
};

export function AssistantPanel({
  para,
  indisponivel,
  onPedir,
  onFechar,
}: AssistantPanelProps) {
  const [texto, setTexto] = useState("");
  const [turnos, setTurnos] = useState<TurnoAssistente[]>([]);
  /** A pergunta na tela, no modo guiado. */
  const [pergunta, setPergunta] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const pedir = async (modo: ModoAssistente) => {
    const dito = texto.trim();
    if (!dito || ocupado) return;
    setOcupado(true);
    setErro("");
    // O que a pessoa acabou de dizer entra na conversa ANTES da chamada: no
    // modo guiado, a resposta dela à pergunta anterior é o turno novo.
    const proximos: TurnoAssistente[] = [
      ...turnos,
      { quem: "pessoa", texto: dito },
    ];
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

      <textarea
        className="axxa-textarea axxa-assist-campo"
        value={texto}
        rows={3}
        placeholder={pergunta ? "Your answer…" : EXEMPLO[para]}
        aria-label={pergunta || CONVITE[para]}
        disabled={ocupado}
        onChange={(e) => setTexto(e.currentTarget.value)}
      />

      {erro && (
        <p className="axxa-assist-erro" role="status">
          <Icon name="info" size={14} />
          <span>{erro}</span>
        </p>
      )}

      <div className="axxa-assist-acoes">
        {/* O guiado some depois da primeira pergunta: a conversa já está
            acontecendo, e dois botões ali só ofereceriam sair dela pelo meio. */}
        {!pergunta && (
          <button
            type="button"
            className="axxa-home-filter"
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
          disabled={ocupado || !texto.trim()}
          onClick={() => void pedir(pergunta ? "guiado" : "direto")}
        >
          <Icon name={ocupado ? "loader" : "sparkles"} size={16} />
          <span>{ocupado ? "Writing…" : pergunta ? "Send" : "Write it"}</span>
        </button>
      </div>
    </div>
  );
}

/** O botão que ABRE o painel — a mesma peça nos dois formulários. */
export function AssistantButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="axxa-assist-abrir" onClick={onClick}>
      <Icon name="sparkles" size={16} />
      <span>Write it for me</span>
    </button>
  );
}
