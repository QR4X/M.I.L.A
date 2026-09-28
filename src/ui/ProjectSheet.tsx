// src/ui/ProjectSheet.tsx
// O FORMULÁRIO de um projeto — o conteúdo, não a folha (ver SkillSheet.tsx
// pra por que isto deixou de ser uma folha própria na 0.6.57).
//
// Criar um projeto era um modal pedindo o nome, e pronto: ícone e cor eram
// sempre os primeiros da lista, então todo projeto nascia com a mesma cara e a
// grade de 28 ícones que já existia no código nunca chegava à tela. Numa lista
// de seis projetos idênticos, o nome vira a única pista — e a lista inteira
// passa a exigir leitura.
//
// O botão de concluir é da FOLHA (prop `footer`), não daqui.
//
// Aqui o projeto se apresenta enquanto é feito: o cartão em cima muda conforme
// se escolhe, e é ele que vai aparecer na lista depois.

import {
  PROJECT_COLORS,
  PROJECT_ICONS,
  projectColor,
  type ProjectDraft,
} from "../projects";
import { Icon } from "./Icon";
import {
  SheetField,
  SheetIconCatalog,
  SheetIconGrid,
  SheetInput,
  SheetSwatches,
} from "./SheetForm";
import { useState } from "react";
import type AxxaPlugin from "../main";
import { AssistantPanel, ComAssistente } from "./AssistantPanel";
import { useAssistant } from "./useAssistant";

export function ProjectForm({
  draft,
  focar,
  onDraft,
  plugin,
  onNotas,
}: {
  draft: ProjectDraft;
  focar: boolean;
  onDraft: (d: ProjectDraft) => void;
  plugin: AxxaPlugin;
  /**
   * A assistente também sugere NOTAS e INSTRUÇÕES, e essas duas não cabem no
   * rascunho: `ProjectDraft` é só nome/ícone/cor — o resto do projeto só
   * existe depois que ele é criado. Quem sabe guardar isso é a folha.
   */
  onNotas?: (notas: string[], instrucoes: string) => void;
}) {
  const set = (campo: Partial<ProjectDraft>) => onDraft({ ...draft, ...campo });
  const cor = projectColor(draft.color);
  const [procurando, setProcurando] = useState(false);
  const [ajudando, setAjudando] = useState(false);
  const { indisponivel, pedirProjeto, alvo, modelos, escolherModelo } = useAssistant(plugin);

  // Procurar ícone TOMA a tela. O formulário sai inteiro — cartão, nome — e
  // ficam três coisas: voltar, a cor e os ícones. A cor fica porque é ela que
  // decide como cada ícone aparece: trocar de cor com a grade aberta mostra na
  // hora, e é a pergunta que se faz olhando os dois juntos.
  if (procurando)
    return (
      <SheetIconCatalog
        value={draft.icon}
        tint={cor}
        onBack={() => setProcurando(false)}
        onPick={(icon) => set({ icon })}
      >
        <SheetField label="Color">
          <SheetSwatches
            colors={PROJECT_COLORS}
            value={draft.color}
            resolve={projectColor}
            onPick={(color) => set({ color })}
          />
        </SheetField>
      </SheetIconCatalog>
    );

  return (
    <>
      <div className="axxa-form-preview">
        <span
          className="axxa-thing-mark"
          style={{ color: cor }}
          aria-hidden="true"
        >
          <Icon name={draft.icon} size={20} />
        </span>
        <span className="axxa-thing-text">
          <span className="axxa-thing-name">
            {draft.name.trim() || "Untitled project"}
          </span>
          <span className="axxa-thing-note">No notes yet · no chats yet</span>
        </span>
      </div>

      <SheetField label="Name">
        {/* O primeiro campo vazio da tela é onde a oferta faz sentido:
            daqui ela monta o projeto inteiro — nome, ícone, cor,
            instruções e as notas de origem. */}
        <ComAssistente
          aberto={ajudando}
          onAbrir={() => setAjudando(true)}
          painel={
            <AssistantPanel
              para="project"
              indisponivel={indisponivel}
              modelo={{
                atual: alvo?.model ?? "",
                opcoes: modelos,
                onTrocar: (m) => void escolherModelo(m),
              }}
              onFechar={() => setAjudando(false)}
              onPedir={async (modo, turnos) => {
                const r = await pedirProjeto(modo, turnos);
                if (r.draft) {
                  set({
                    name: r.draft.name,
                    icon: r.draft.icon,
                    color: r.draft.color,
                  });
                  // Notas e instruções não cabem no rascunho — a folha
                  // guarda e aplica assim que o projeto existir.
                  onNotas?.(r.draft.notes, r.draft.instructions);
                  return { pronto: true };
                }
                return { pergunta: r.pergunta, erro: r.erro };
              }}
            />
          }
        >
          <SheetInput
            comSpark
            value={draft.name}
            placeholder="Thesis, Client X, Apartment…"
            autoFocus={focar}
            onChange={(name) => set({ name })}
          />
        </ComAssistente>
      </SheetField>

      <SheetField label="Color">
        <SheetSwatches
          colors={PROJECT_COLORS}
          value={draft.color}
          resolve={projectColor}
          onPick={(color) => set({ color })}
        />
      </SheetField>

      <SheetField label="Icon">
        <SheetIconGrid
          icons={PROJECT_ICONS}
          value={draft.icon}
          tint={cor}
          onBrowse={() => setProcurando(true)}
          onPick={(icon) => set({ icon })}
        />
      </SheetField>

    </>
  );
}
