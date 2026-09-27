// src/ui/painel.ts
// O contexto das FOLHAS que moram no App (Projects e Skills).
//
// Existe por causa de um caminho só, mas um caminho que atravessa a árvore
// inteira: o ⋯ de uma conversa oferece "Add to project ▸ New project…", e a
// lista de conversas aparece em cinco telas diferentes (home, tela de módulo,
// histórico, busca, e dentro do próprio projeto). Passar um `onNovoProjeto`
// de mão em mão pelos cinco seria cinco props existindo só pra chegar num
// lugar — e a sexta tela nasceria sem ele.
//
// O contexto carrega a INTENÇÃO, não a folha: quem abre e fecha continua sendo
// o App.

import { createContext, useContext } from "react";

export interface PainelApi {
  /**
   * Abre a folha de projetos pra criar um, LEVANDO a conversa junto: o projeto
   * criado já nasce com ela dentro. Sem isso, quem criou o projeto pelo menu de
   * uma conversa teria que voltar até ela e repetir o caminho.
   */
  novoProjetoCom: (chatId: string) => void;
}

export const PainelCtx = createContext<PainelApi>({
  novoProjetoCom: () => {},
});

export function usePainel(): PainelApi {
  return useContext(PainelCtx);
}
