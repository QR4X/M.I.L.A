// src/ui/wizard.ts
// A DECISÃO do pé de um wizard: quais botões existem nesta tela e o que a
// linha de status diz.
//
// É meia dúzia de ternários, e é por isso que está aqui em vez de dentro do
// JSX. Cada um deles já errou uma vez em algum formulário deste app:
//
// · o "Back" que aparecia no primeiro passo e queria dizer "sair", concorrendo
//   com a seta da barra de cima que queria dizer a mesma coisa em outro lugar;
// · o "o que falta" aparecendo na tela do prompt — um aviso sobre uma pergunta
//   que a fila ainda não tinha feito, lido como erro do que a pessoa acabou de
//   escrever;
// · o wizard que obrigava a atravessar os enfeites depois de a assistente já
//   ter devolvido a coisa inteira pronta no primeiro passo.
//
// Escrito como função pura, cada um desses casos é uma linha de teste em vez de
// um print no celular.

export interface PeDoWizard {
  /** Este é o último passo — é aqui que se conclui. */
  ultimo: boolean;
  /** O botão de voltar um passo existe nesta tela. */
  back: boolean;
  /** O botão da direita: avança a fila, ou conclui. */
  primario: "next" | "submit";
  /** O botão de concluir se oferece? (`false` = ele explica o que falta.) */
  pronto: boolean;
  /**
   * O que ocupa a linha de status:
   * · "problema" — o que falta pra salvar, só onde há o que salvar;
   * · "atalho"   — já dá pra concluir e ainda sobram passos;
   * · null       — nada a dizer, e então nada é dito.
   */
  status: "problema" | "atalho" | null;
}

export function peDoWizard(p: {
  /** Índice do passo atual. */
  atual: number;
  /** Quantos passos a fila tem. */
  total: number;
  /** O que impede de salvar agora; null/"" = pronto. */
  problema?: string | null;
}): PeDoWizard {
  // `total` pode chegar em 0 ou 1 (uma fila de um passo é um formulário comum):
  // nesse caso o único passo é o último, e não há para onde avançar.
  const ultimo = p.atual >= p.total - 1;
  const falta = !!p.problema;
  return {
    ultimo,
    back: p.atual > 0,
    primario: ultimo ? "submit" : "next",
    pronto: !falta,
    status: ultimo ? (falta ? "problema" : null) : falta ? null : "atalho",
  };
}
