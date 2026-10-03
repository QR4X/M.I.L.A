// src/assistant/run.ts
// A CHAMADA: junta o prompt, a conversa até aqui e o alvo, e traz de volta ou
// uma pergunta ou um rascunho.
//
// Uma volta só, sem streaming: o que sai daqui é um formulário preenchido, e
// formulário não se lê enquanto aparece. `chat()` em vez de `streamChat()`
// também deixa a coisa cancelável de graça — quem fechou a folha simplesmente
// ignora o que chegar.

import type { Provider, ProviderMessage } from "../providers/base";
import { lerObjeto, lerOpcoes, lerPergunta } from "./parse";
import { tr } from "../i18n/tr";

/** Uma rodada da conversa com a assistente. */
export interface TurnoAssistente {
  quem: "pessoa" | "assistente";
  texto: string;
}

export interface PedidoAssistente {
  provider: Provider;
  apiKey: string;
  model: string;
  /** O prompt de sistema montado (ver prompt.ts). */
  sistema: string;
  /** O que já foi dito — no modo direto, uma linha só. */
  turnos: TurnoAssistente[];
}

/** O que voltou: uma pergunta, um objeto pra virar rascunho, ou um problema. */
export interface RetornoAssistente {
  pergunta?: string;
  /** As pastilhas de resposta da pergunta acima, quando ela oferece. */
  opcoes?: string[];
  /** O objeto cru do campo `draft` — quem chama passa pro `lerSkill`/`lerProjeto`. */
  bruto?: Record<string, unknown>;
  /** Frase pronta pra mostrar. Presente = não deu. */
  erro?: string;
}

/**
 * Chama e interpreta.
 *
 * Nunca lança: esta função é chamada de um botão dentro de um formulário, e um
 * erro que sobe daqui derruba o formulário inteiro com o que a pessoa já tinha
 * escrito. Todo caminho ruim vira `erro` — uma frase, em pé.
 */
export async function pedirAjuda(
  p: PedidoAssistente
): Promise<RetornoAssistente> {
  const messages: ProviderMessage[] = [
    { role: "system", content: p.sistema },
    ...p.turnos.map((t): ProviderMessage => ({
      role: t.quem === "pessoa" ? "user" : "assistant",
      content: t.texto,
    })),
  ];

  let resposta;
  try {
    resposta = await p.provider.chat(
      {
        model: p.model,
        messages,
        maxTokens: 1200,
        // Baixa de propósito: o resultado é preenchimento de formulário, e
        // criatividade aqui vira nome pomposo e instrução genérica.
        temperature: 0.4,
      },
      p.apiKey
    );
  } catch (e) {
    return {
      erro: (e as Error).message || tr("The assistant could not answer."),
    };
  }

  const obj = lerObjeto(resposta.content ?? "");
  if (!obj)
    // Acontece com modelo free pequeno: ele responde em prosa apesar do
    // contrato. Dizer isso é melhor que "erro": a saída é trocar de modelo, e
    // a pessoa só sabe disso se a gente contar.
    return {
      erro: tr(
        "The assistant answered in prose instead of the expected format. A stronger model usually fixes it."
      ),
    };

  const pergunta = lerPergunta(obj);
  if (pergunta) return { pergunta, opcoes: lerOpcoes(obj) };

  const bruto = obj.draft;
  if (bruto && typeof bruto === "object" && !Array.isArray(bruto))
    return { bruto: bruto as Record<string, unknown> };

  // Veio JSON, mas sem `ask` nem `draft`. Alguns modelos devolvem os campos
  // soltos no primeiro nível — aceitar isso é barato e evita uma volta inteira
  // à toa.
  return { bruto: obj };
}
